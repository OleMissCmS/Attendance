-- Persist miss attempts outside check_in (raise rolls back in-transaction inserts).
-- Auto check-in for rostered emails without a live classroom code.
-- Platform admin listing of failed check-in emails.

create or replace function public.log_roster_miss_attempt(
  p_session_id uuid,
  p_email_hash text,
  p_email_cipher text,
  p_device_id uuid default null,
  p_source text default 'check_in'
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_section bigint;
  src text := coalesce(nullif(trim(p_source), ''), 'check_in');
begin
  if p_session_id is null then
    return;
  end if;
  if p_email_hash is null or length(p_email_hash) < 32 then
    return;
  end if;
  if p_email_cipher is null or length(trim(p_email_cipher)) = 0 then
    return;
  end if;
  if src not in ('check_in', 'roster_add_enrolled') then
    src := 'check_in';
  end if;

  select s.section_id into session_section
  from public.attendance_sessions s
  where s.id = p_session_id;

  if session_section is null then
    return;
  end if;

  insert into public.roster_miss_attempts (
    section_id,
    session_id,
    device_id,
    attempted_email_hash,
    attempted_email_cipher,
    source
  ) values (
    session_section,
    p_session_id,
    p_device_id,
    p_email_hash,
    p_email_cipher,
    src
  );
end;
$$;

grant execute on function public.log_roster_miss_attempt(uuid, text, text, uuid, text)
  to anon, authenticated;

-- Check in a rostered student without requiring a valid rotating code.
create or replace function public.check_in_rostered(
  p_session_id uuid,
  p_email_hash text,
  p_email_cipher text,
  p_device_id uuid,
  p_is_incognito boolean default false,
  p_alt_email_hashes text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_section bigint;
  roster_hash text;
  roster_cipher text;
  bound_hash text;
  new_device boolean := false;
begin
  if p_device_id is null then
    raise exception 'Device required';
  end if;
  if p_email_hash is null or length(p_email_hash) < 32 then
    raise exception 'Enter a valid email';
  end if;

  select s.section_id into session_section
  from public.attendance_sessions s
  where s.id = p_session_id;

  if session_section is null then
    raise exception 'Session not found';
  end if;

  roster_hash := private.enrollment_hash_for_section(
    session_section,
    p_email_hash,
    p_alt_email_hashes
  );

  if roster_hash is null then
    raise exception 'You are not on this roster';
  end if;

  roster_cipher := coalesce(
    private.email_cipher_for_hash(roster_hash, session_section),
    p_email_cipher
  );

  select email_hash into bound_hash
  from private.device_identities
  where device_id = p_device_id;

  new_device := bound_hash is null;

  if bound_hash is not null and bound_hash <> roster_hash then
    raise exception 'This phone is already used by another student';
  end if;

  if new_device then
    insert into private.device_identities (device_id, email_hash)
    values (p_device_id, roster_hash)
    on conflict (device_id) do nothing;
  end if;

  insert into public.attendance_records (
    session_id,
    email_hash,
    email_cipher,
    is_incognito,
    is_new_device,
    flagged_late_device
  )
  values (
    p_session_id,
    roster_hash,
    roster_cipher,
    coalesce(p_is_incognito, false),
    false,
    false
  )
  on conflict (session_id, email_hash) do nothing;

  if not found then
    insert into private.device_checkins (session_id, device_id, email_hash)
    values (p_session_id, p_device_id, roster_hash)
    on conflict (session_id, device_id) do nothing;
    return jsonb_build_object(
      'ok', true,
      'already_checked_in', true,
      'checked_in_at', now(),
      'email_aliased', roster_hash is distinct from p_email_hash
    );
  end if;

  insert into private.device_checkins (session_id, device_id, email_hash)
  values (p_session_id, p_device_id, roster_hash)
  on conflict (session_id, device_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'already_checked_in', false,
    'checked_in_at', now(),
    'email_aliased', roster_hash is distinct from p_email_hash
  );
end;
$$;

grant execute on function public.check_in_rostered(uuid, text, text, uuid, boolean, text[])
  to anon, authenticated;

-- Admin list of failed check-in emails (cipher only; decrypt in app).
create or replace function public.list_roster_miss_attempts(p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  select coalesce(jsonb_agg(row_to_json(r)::jsonb order by r.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      m.id,
      m.created_at,
      m.source,
      m.session_id,
      m.section_id,
      m.attempted_email_cipher,
      c.code as course_code,
      c.name as course_name,
      sec.label as section_label,
      s.started_at as session_started_at
    from public.roster_miss_attempts m
    join public.sections sec on sec.id = m.section_id
    join public.courses c on c.id = sec.course_id
    join public.attendance_sessions s on s.id = m.session_id
    order by m.created_at desc
    limit lim
  ) r;

  return result;
end;
$$;

grant execute on function public.list_roster_miss_attempts(integer) to authenticated;

-- Stop inserting miss rows inside check_in (rolled back by raise).
create or replace function public.check_in(
  p_session_id uuid,
  p_token text,
  p_email_hash text,
  p_email_cipher text,
  p_device_id uuid,
  p_is_incognito boolean default false,
  p_is_test boolean default false,
  p_alt_email_hashes text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  secret text;
  w bigint;
  normalized_token text;
  session_section bigint;
  existing_device_hash text;
  bound_hash text;
  bound_cipher text;
  existing_cipher text;
  matched boolean := false;
  new_device boolean := false;
  late_device boolean := false;
  prior_count integer := 0;
  test_ok boolean := false;
  roster_hash text;
  roster_cipher text;
begin
  if p_device_id is null then
    raise exception 'Device required';
  end if;

  if p_email_hash is null or length(p_email_hash) < 32 then
    raise exception 'Enter a valid email';
  end if;

  test_ok := coalesce(p_is_test, false)
    and coalesce((select allow_test_student from private.app_settings where id = 1), false);

  select s.section_id into session_section
  from public.attendance_sessions s
  where s.id = p_session_id and s.ended_at is null;

  if session_section is null then
    raise exception 'No live session';
  end if;

  select token_secret into secret
  from private.session_secrets
  where session_id = p_session_id;

  normalized_token := upper(trim(p_token));
  w := private.current_window();

  if normalized_token = private.token_for_window(p_session_id, secret, w)
     or normalized_token = private.token_for_window(p_session_id, secret, w - 1) then
    matched := true;
  end if;

  if not matched then
    raise exception 'Code expired or incorrect';
  end if;

  roster_hash := p_email_hash;
  roster_cipher := p_email_cipher;

  if not test_ok then
    roster_hash := private.enrollment_hash_for_section(
      session_section,
      p_email_hash,
      p_alt_email_hashes
    );

    if roster_hash is null then
      raise exception 'You are not on this roster';
    end if;

    roster_cipher := coalesce(
      private.email_cipher_for_hash(roster_hash, session_section),
      p_email_cipher
    );

    select email_hash into bound_hash
    from private.device_identities
    where device_id = p_device_id;

    new_device := bound_hash is null;

    if bound_hash is not null and bound_hash <> roster_hash then
      bound_cipher := coalesce(
        private.email_cipher_for_hash(bound_hash, session_section),
        ''
      );
      insert into public.attendance_flags (
        session_id,
        section_id,
        device_id,
        flag_type,
        bound_email_hash,
        bound_email_cipher,
        attempted_email_hash,
        attempted_email_cipher
      ) values (
        p_session_id,
        session_section,
        p_device_id,
        'device_conflict',
        bound_hash,
        bound_cipher,
        p_email_hash,
        p_email_cipher
      );
      return jsonb_build_object(
        'ok', false,
        'error', 'This phone is already used by another student',
        'flagged', true,
        'flag_type', 'device_conflict'
      );
    end if;

    select count(*)::int into prior_count
    from public.attendance_sessions s
    where s.section_id = session_section and s.id <> p_session_id;

    late_device := new_device and prior_count >= 4;

    select email_hash into existing_device_hash
    from private.device_checkins
    where session_id = p_session_id and device_id = p_device_id;

    if existing_device_hash is not null and existing_device_hash <> roster_hash then
      existing_cipher := coalesce(
        private.email_cipher_for_hash(existing_device_hash, session_section),
        ''
      );
      insert into public.attendance_flags (
        session_id,
        section_id,
        device_id,
        flag_type,
        bound_email_hash,
        bound_email_cipher,
        attempted_email_hash,
        attempted_email_cipher
      ) values (
        p_session_id,
        session_section,
        p_device_id,
        'device_conflict',
        existing_device_hash,
        existing_cipher,
        p_email_hash,
        p_email_cipher
      );
      return jsonb_build_object(
        'ok', false,
        'error', 'This phone already checked in another student for this class',
        'flagged', true,
        'flag_type', 'device_conflict'
      );
    end if;
  end if;

  if not test_ok and new_device then
    insert into private.device_identities (device_id, email_hash)
    values (p_device_id, roster_hash)
    on conflict (device_id) do nothing;
  end if;

  insert into public.attendance_records (
    session_id,
    email_hash,
    email_cipher,
    is_incognito,
    is_new_device,
    flagged_late_device
  )
  values (
    p_session_id,
    roster_hash,
    roster_cipher,
    coalesce(p_is_incognito, false),
    false,
    false
  )
  on conflict (session_id, email_hash) do nothing;

  if not found then
    if not test_ok then
      insert into private.device_checkins (session_id, device_id, email_hash)
      values (p_session_id, p_device_id, roster_hash)
      on conflict (session_id, device_id) do nothing;
    end if;
    raise exception 'Already checked in';
  end if;

  if not test_ok then
    insert into private.device_checkins (session_id, device_id, email_hash)
    values (p_session_id, p_device_id, roster_hash)
    on conflict (session_id, device_id) do nothing;
  end if;

  if not test_ok and late_device then
    insert into public.attendance_flags (
      session_id,
      section_id,
      device_id,
      flag_type,
      bound_email_hash,
      bound_email_cipher,
      attempted_email_hash,
      attempted_email_cipher
    ) values (
      p_session_id,
      session_section,
      p_device_id,
      'late_device',
      roster_hash,
      roster_cipher,
      p_email_hash,
      p_email_cipher
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'checked_in_at', now(),
    'is_incognito', coalesce(p_is_incognito, false),
    'is_new_device', new_device,
    'flagged_late_device', late_device,
    'is_test', test_ok,
    'email_aliased', roster_hash is distinct from p_email_hash
  );
end;
$$;

grant execute on function public.check_in(uuid, text, text, text, uuid, boolean, boolean, text[])
  to anon, authenticated;

-- When roster-add finds an enrolled email, raise a dedicated code (app will check them in).
create or replace function public.request_roster_addition(
  p_session_id uuid,
  p_email_hash text,
  p_email_cipher text,
  p_last_name_cipher text,
  p_first_name_cipher text,
  p_username_cipher text,
  p_student_id_cipher text,
  p_name_cipher text,
  p_alt_email_hashes text[] default null,
  p_check_in_email_hash text default null,
  p_check_in_email_cipher text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_section bigint;
  roster_hash text;
begin
  if p_email_hash is null or length(p_email_hash) < 32 then
    raise exception 'Enter a valid email';
  end if;
  if p_email_cipher is null or length(trim(p_email_cipher)) = 0 then
    raise exception 'Enter a valid email';
  end if;

  select s.section_id into session_section
  from public.attendance_sessions s
  where s.id = p_session_id;

  if session_section is null then
    raise exception 'Session not found';
  end if;

  roster_hash := private.enrollment_hash_for_section(
    session_section,
    p_email_hash,
    p_alt_email_hashes
  );

  if roster_hash is not null then
    raise exception 'Already on this roster';
  end if;

  insert into public.roster_add_requests (
    section_id,
    session_id,
    email_hash,
    email_cipher,
    last_name_cipher,
    first_name_cipher,
    username_cipher,
    student_id_cipher,
    name_cipher,
    check_in_email_hash,
    check_in_email_cipher,
    status
  )
  values (
    session_section,
    p_session_id,
    p_email_hash,
    p_email_cipher,
    p_last_name_cipher,
    p_first_name_cipher,
    p_username_cipher,
    p_student_id_cipher,
    p_name_cipher,
    nullif(p_check_in_email_hash, ''),
    nullif(p_check_in_email_cipher, ''),
    'pending'
  )
  on conflict (section_id, email_hash) do update
    set session_id = excluded.session_id,
        email_cipher = excluded.email_cipher,
        last_name_cipher = excluded.last_name_cipher,
        first_name_cipher = excluded.first_name_cipher,
        username_cipher = excluded.username_cipher,
        student_id_cipher = excluded.student_id_cipher,
        name_cipher = excluded.name_cipher,
        check_in_email_hash = coalesce(
          excluded.check_in_email_hash,
          public.roster_add_requests.check_in_email_hash
        ),
        check_in_email_cipher = coalesce(
          excluded.check_in_email_cipher,
          public.roster_add_requests.check_in_email_cipher
        ),
        status = 'pending',
        resolved_at = null,
        created_at = now()
    where public.roster_add_requests.status <> 'added';
end;
$$;

grant execute on function public.request_roster_addition(
  uuid, text, text, text, text, text, text, text, text[], text, text
) to anon, authenticated;
