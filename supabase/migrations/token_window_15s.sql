-- Rotate classroom codes every 15 seconds (was 10).
-- Keep ~30s validity by accepting the current and previous window only.

create or replace function private.token_window_seconds()
returns integer
language sql
immutable
set search_path to ''
as $$
  select 15;
$$;

create or replace function private.current_window()
returns bigint
language sql
stable
set search_path to ''
as $$
  select floor(
    extract(epoch from clock_timestamp()) / private.token_window_seconds()
  )::bigint;
$$;

create or replace function public.code_expires_in(
  p_session_id uuid,
  p_token text
)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  secret text;
  normalized_token text;
  w bigint;
  tw bigint;
  window_seconds integer := private.token_window_seconds();
  now_epoch double precision;
begin
  if p_session_id is null or p_token is null or length(trim(p_token)) = 0 then
    return 0;
  end if;

  if not exists (
    select 1 from public.attendance_sessions s
    where s.id = p_session_id and s.ended_at is null
  ) then
    return 0;
  end if;

  select token_secret into secret
  from private.session_secrets
  where session_id = p_session_id;

  if secret is null then
    return 0;
  end if;

  normalized_token := upper(trim(p_token));
  w := private.current_window();
  now_epoch := extract(epoch from clock_timestamp());

  -- Current + previous window ≈ 30 seconds with 15s rotation.
  if normalized_token = private.token_for_window(p_session_id, secret, w) then
    tw := w;
  elsif normalized_token = private.token_for_window(p_session_id, secret, w - 1) then
    tw := w - 1;
  else
    return 0;
  end if;

  return greatest(
    0,
    ceil(((tw + 2) * window_seconds) - now_epoch)::integer
  );
end;
$$;

create or replace function public.session_display_code(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  secret text;
  w bigint;
  live boolean;
  window_seconds integer := private.token_window_seconds();
  now_epoch double precision;
begin
  select exists (
    select 1
    from public.attendance_sessions s
    join public.sections sec on sec.id = s.section_id
    where s.id = p_session_id
      and public.has_course_access(sec.course_id)
      and s.ended_at is null
  ) into live;

  if not live then
    raise exception 'Live session not found';
  end if;

  select token_secret into secret
  from private.session_secrets
  where session_id = p_session_id;

  w := private.current_window();
  now_epoch := extract(epoch from clock_timestamp());

  return jsonb_build_object(
    'code', private.token_for_window(p_session_id, secret, w),
    'window', w,
    'valid_seconds', window_seconds * 2,
    'expires_at', (w + 2) * window_seconds,
    'expires_in', greatest(0, ceil(((w + 2) * window_seconds) - now_epoch)::integer)
  );
end;
$$;

-- Align check-in acceptance with 15s windows × 2 = ~30s validity.
create or replace function public.check_in(
  p_session_id uuid,
  p_token text,
  p_email_hash text,
  p_email_cipher text,
  p_device_id uuid,
  p_is_incognito boolean default false,
  p_is_test boolean default false
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
  enrolled boolean;
  existing_device_hash text;
  bound_hash text;
  bound_cipher text;
  existing_cipher text;
  matched boolean := false;
  new_device boolean := false;
  late_device boolean := false;
  prior_count integer := 0;
  test_ok boolean := false;
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

  if not test_ok then
    select email_hash into bound_hash
    from private.device_identities
    where device_id = p_device_id;

    new_device := bound_hash is null;

    if bound_hash is not null and bound_hash <> p_email_hash then
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

    select exists (
      select 1 from public.enrollments e
      where e.section_id = session_section and e.email_hash = p_email_hash
    ) into enrolled;

    if not enrolled then
      raise exception 'You are not on this roster';
    end if;

    select count(*)::int into prior_count
    from public.attendance_sessions s
    where s.section_id = session_section and s.id <> p_session_id;

    late_device := new_device and prior_count >= 4;

    select email_hash into existing_device_hash
    from private.device_checkins
    where session_id = p_session_id and device_id = p_device_id;

    if existing_device_hash is not null and existing_device_hash <> p_email_hash then
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
    values (p_device_id, p_email_hash)
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
    p_email_hash,
    p_email_cipher,
    coalesce(p_is_incognito, false),
    false,
    false
  )
  on conflict (session_id, email_hash) do nothing;

  if not found then
    if not test_ok then
      insert into private.device_checkins (session_id, device_id, email_hash)
      values (p_session_id, p_device_id, p_email_hash)
      on conflict (session_id, device_id) do nothing;
    end if;
    raise exception 'Already checked in';
  end if;

  if not test_ok then
    insert into private.device_checkins (session_id, device_id, email_hash)
    values (p_session_id, p_device_id, p_email_hash)
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
      p_email_hash,
      p_email_cipher,
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
    'is_test', test_ok
  );
end;
$$;

-- CREATE OR REPLACE can drop prior EXECUTE grants; re-assert for projector/check-in.
grant execute on function public.session_display_code(uuid) to authenticated;
grant execute on function public.code_expires_in(uuid, text) to anon, authenticated;
grant execute on function public.check_in(uuid, text, text, text, uuid, boolean, boolean) to anon, authenticated;
