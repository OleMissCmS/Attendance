-- Log emails used when check-in / roster-add finds no matching enrollment,
-- and accept @olemiss.edu ↔ @go.olemiss.edu aliases for the same local-part.

create table if not exists public.roster_miss_attempts (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.sections (id) on delete cascade,
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  device_id uuid,
  attempted_email_hash text not null,
  attempted_email_cipher text not null,
  source text not null check (source in ('check_in', 'roster_add_enrolled')),
  alias_match_email_hash text,
  created_at timestamptz not null default now()
);

create index if not exists roster_miss_attempts_section_id_idx
  on public.roster_miss_attempts (section_id, created_at desc);

create index if not exists roster_miss_attempts_session_id_idx
  on public.roster_miss_attempts (session_id);

alter table public.roster_miss_attempts enable row level security;

drop policy if exists roster_miss_attempts_select on public.roster_miss_attempts;
create policy roster_miss_attempts_select on public.roster_miss_attempts
  for select using (public.has_section_access(section_id));

grant select on public.roster_miss_attempts to authenticated;

alter table public.roster_add_requests
  add column if not exists check_in_email_hash text,
  add column if not exists check_in_email_cipher text;

-- Resolve enrollment by primary hash or optional Ole Miss domain aliases.
create or replace function private.enrollment_hash_for_section(
  p_section_id bigint,
  p_email_hash text,
  p_alt_email_hashes text[] default null
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  matched text;
  alt text;
begin
  select e.email_hash into matched
  from public.enrollments e
  where e.section_id = p_section_id and e.email_hash = p_email_hash
  limit 1;

  if matched is not null then
    return matched;
  end if;

  if p_alt_email_hashes is null then
    return null;
  end if;

  foreach alt in array p_alt_email_hashes loop
    if alt is null or length(alt) < 32 then
      continue;
    end if;
    select e.email_hash into matched
    from public.enrollments e
    where e.section_id = p_section_id and e.email_hash = alt
    limit 1;
    if matched is not null then
      return matched;
    end if;
  end loop;

  return null;
end;
$$;

drop function if exists public.check_in(uuid, text, text, text, uuid, boolean, boolean);

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
        'check_in'
      );
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

drop function if exists public.request_roster_addition(
  uuid, text, text, text, text, text, text, text
);

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
    insert into public.roster_miss_attempts (
      section_id,
      session_id,
      device_id,
      attempted_email_hash,
      attempted_email_cipher,
      source,
      alias_match_email_hash
    ) values (
      session_section,
      p_session_id,
      null,
      p_email_hash,
      p_email_cipher,
      'roster_add_enrolled',
      case when roster_hash is distinct from p_email_hash then roster_hash else null end
    );
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

grant execute on function public.check_in(uuid, text, text, text, uuid, boolean, boolean, text[])
  to anon, authenticated;
grant execute on function public.request_roster_addition(
  uuid, text, text, text, text, text, text, text, text[], text, text
) to anon, authenticated;
