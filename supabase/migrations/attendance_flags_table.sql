-- Faculty-visible device flags live in attendance_flags (not on attendance_records).
-- late_device: new phone after the 4th prior session in the section.
-- device_conflict: phone already linked to another student (check-in blocked after flag).

create table if not exists public.attendance_flags (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  section_id bigint not null references public.sections(id) on delete cascade,
  device_id uuid,
  flag_type text not null check (flag_type in ('late_device', 'device_conflict')),
  bound_email_hash text not null,
  bound_email_cipher text not null,
  attempted_email_hash text not null,
  attempted_email_cipher text not null,
  created_at timestamptz not null default now()
);

create index if not exists attendance_flags_session_id_idx
  on public.attendance_flags (session_id);

create index if not exists attendance_flags_section_id_idx
  on public.attendance_flags (section_id);

create index if not exists attendance_flags_flag_type_idx
  on public.attendance_flags (flag_type);

alter table public.attendance_flags enable row level security;

drop policy if exists attendance_flags_faculty_select on public.attendance_flags;
create policy attendance_flags_faculty_select on public.attendance_flags
  for select using (public.has_section_access(section_id));

grant select on public.attendance_flags to authenticated;

-- Backfill historical late-device marks from attendance_records (if any).
insert into public.attendance_flags (
  session_id,
  section_id,
  device_id,
  flag_type,
  bound_email_hash,
  bound_email_cipher,
  attempted_email_hash,
  attempted_email_cipher,
  created_at
)
select
  ar.session_id,
  s.section_id,
  null,
  'late_device',
  ar.email_hash,
  ar.email_cipher,
  ar.email_hash,
  ar.email_cipher,
  ar.checked_in_at
from public.attendance_records ar
join public.attendance_sessions s on s.id = ar.session_id
where ar.flagged_late_device = true
  and not exists (
    select 1
    from public.attendance_flags f
    where f.session_id = ar.session_id
      and f.flag_type = 'late_device'
      and f.attempted_email_hash = ar.email_hash
  );

create or replace function private.email_cipher_for_hash(
  p_email_hash text,
  p_section_id bigint
)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  cipher text;
begin
  select e.email_cipher into cipher
  from public.enrollments e
  where e.section_id = p_section_id and e.email_hash = p_email_hash
  limit 1;

  if cipher is not null then
    return cipher;
  end if;

  select ar.email_cipher into cipher
  from public.attendance_records ar
  join public.attendance_sessions s on s.id = ar.session_id
  where ar.email_hash = p_email_hash
  order by case when s.section_id = p_section_id then 0 else 1 end,
           ar.checked_in_at desc
  limit 1;

  return cipher;
end;
$function$;

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
as $function$
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
     or normalized_token = private.token_for_window(p_session_id, secret, w - 1)
     or normalized_token = private.token_for_window(p_session_id, secret, w - 2) then
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
      raise exception 'This phone is already used by another student';
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

    -- Only faculty-visible when the section already has 4+ prior sessions.
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
      raise exception 'This phone already checked in another student for this class';
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
$function$;
