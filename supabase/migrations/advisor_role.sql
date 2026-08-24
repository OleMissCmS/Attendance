-- Advisor role: view-all attendance data, no writes.

create table if not exists private.advisor_emails (
  email text primary key
);

insert into private.advisor_emails (email)
values
  ('emridout@olemiss.edu'),
  ('mcclure@olemiss.edu')
on conflict (email) do nothing;

create or replace function private.is_advisor_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from private.advisor_emails a
    where a.email = lower(trim(p_email))
  );
$$;

create or replace function public.is_advisor()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'advisor'
  );
$$;

create or replace function public.can_manage_section(p_section_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.sections s
    join public.courses c on c.id = s.course_id
    where s.id = p_section_id and c.faculty_id = auth.uid()
  ) or exists (
    select 1 from public.section_members m
    where m.section_id = p_section_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_course(p_course_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.faculty_id = auth.uid()
  ) or exists (
    select 1
    from public.sections s
    join public.section_members m on m.section_id = s.id
    where s.course_id = p_course_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_course_access(p_course_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_advisor()
    or exists (
      select 1 from public.courses c
      where c.id = p_course_id and c.faculty_id = auth.uid()
    )
    or exists (
      select 1
      from public.sections s
      join public.section_members m on m.section_id = s.id
      where s.course_id = p_course_id and m.user_id = auth.uid()
    );
$$;

create or replace function public.has_section_access(p_section_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select public.is_advisor()
    or exists (
      select 1
      from public.sections s
      join public.courses c on c.id = s.course_id
      where s.id = p_section_id and c.faculty_id = auth.uid()
    )
    or exists (
      select 1 from public.section_members m
      where m.section_id = p_section_id and m.user_id = auth.uid()
    );
$$;

create or replace function private.may_create_staff_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.is_advisor_email(p_email)
    or private.is_faculty_email(p_email)
    or exists (
      select 1 from public.section_members m
      where m.email = lower(trim(p_email))
    )
    or exists (
      select 1 from public.course_members m
      where m.email = lower(trim(p_email))
    );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  email_norm text := lower(trim(new.email));
  assigned_role text := 'student';
begin
  if not private.may_create_staff_account(email_norm) then
    raise exception 'invalid email address';
  end if;

  if private.is_advisor_email(email_norm) then
    assigned_role := 'advisor';
  elsif private.is_faculty_email(email_norm) then
    assigned_role := 'faculty';
  elsif exists (select 1 from public.section_members where email = email_norm)
     or exists (select 1 from public.course_members where email = email_norm) then
    assigned_role := 'guest';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    email_norm,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(email_norm, '@', 1)),
    assigned_role
  );

  update public.section_members
  set user_id = new.id
  where email = email_norm and user_id is null;

  update public.course_members
  set user_id = new.id
  where email = email_norm and user_id is null;

  return new;
end;
$$;

-- Keep advisor role if they are also invited as a guest later.
create or replace function public.invite_section_guests(p_email text, p_section_ids bigint[])
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  guest_email text := lower(trim(p_email));
  guest_id uuid;
  sid bigint;
begin
  if guest_email is null or position('@' in guest_email) = 0 then
    raise exception 'Enter a valid email';
  end if;
  if p_section_ids is null or cardinality(p_section_ids) = 0 then
    raise exception 'Select at least one section';
  end if;

  foreach sid in array p_section_ids loop
    if not public.owns_section(sid) then
      raise exception 'Not authorized';
    end if;
  end loop;

  select id into guest_id from public.profiles where email = guest_email;

  foreach sid in array p_section_ids loop
    insert into public.section_members (section_id, user_id, email, role)
    values (sid, guest_id, guest_email, 'guest')
    on conflict (section_id, email) do update
      set user_id = coalesce(excluded.user_id, public.section_members.user_id);
  end loop;

  if guest_id is not null then
    update public.profiles
    set role = 'guest'
    where id = guest_id
      and role not in ('faculty', 'advisor');
  end if;
end;
$$;

create or replace function public.start_session(p_section_id bigint)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  new_id uuid;
  secret text;
begin
  if not public.can_manage_section(p_section_id) then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1 from public.sections s
    join public.courses c on c.id = s.course_id
    where s.id = p_section_id
      and (s.deleted_at is not null or c.deleted_at is not null)
  ) then
    raise exception 'Section is archived';
  end if;

  if exists (
    select 1 from public.attendance_sessions
    where section_id = p_section_id and ended_at is null
  ) then
    raise exception 'A live session already exists for this section';
  end if;

  secret := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.attendance_sessions (section_id, started_by)
  values (p_section_id, auth.uid())
  returning id into new_id;

  insert into private.session_secrets (session_id, token_secret)
  values (new_id, secret);

  return new_id;
end;
$$;

create or replace function public.end_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.attendance_sessions s
  set ended_at = now()
  from public.sections sec
  where s.id = p_session_id
    and s.section_id = sec.id
    and public.can_manage_course(sec.course_id)
    and s.ended_at is null;

  if not found then
    raise exception 'Session not found or already ended';
  end if;
end;
$$;

create or replace function public.set_session_attendance(
  p_session_id uuid,
  p_email_hash text,
  p_present boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_section bigint;
  cipher text;
begin
  if p_session_id is null or p_email_hash is null or length(p_email_hash) < 32 then
    raise exception 'Invalid attendance update';
  end if;

  select s.section_id into session_section
  from public.attendance_sessions s
  where s.id = p_session_id;

  if session_section is null then
    raise exception 'Session not found';
  end if;

  if not public.can_manage_section(session_section) then
    raise exception 'Not authorized';
  end if;

  if coalesce(p_present, false) then
    cipher := coalesce(private.email_cipher_for_hash(p_email_hash, session_section), '');
    if cipher = '' then
      raise exception 'Student not found for this section';
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
      cipher,
      false,
      false,
      false
    )
    on conflict (session_id, email_hash) do nothing;
  else
    delete from public.attendance_records
    where session_id = p_session_id
      and email_hash = p_email_hash;
  end if;
end;
$$;

create or replace function public.resolve_roster_add_request(
  p_request_id bigint,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  req public.roster_add_requests%rowtype;
begin
  select * into req from public.roster_add_requests where id = p_request_id;
  if not found then
    raise exception 'Request not found';
  end if;
  if not public.can_manage_section(req.section_id) then
    raise exception 'Not authorized';
  end if;
  if req.status <> 'pending' then
    return;
  end if;

  if p_accept then
    insert into public.enrollments (
      section_id,
      email_hash,
      email_cipher,
      last_name_cipher,
      first_name_cipher,
      username_cipher,
      student_id_cipher,
      name_cipher
    )
    values (
      req.section_id,
      req.email_hash,
      req.email_cipher,
      req.last_name_cipher,
      req.first_name_cipher,
      req.username_cipher,
      req.student_id_cipher,
      req.name_cipher
    )
    on conflict (section_id, email_hash) do nothing;

    insert into public.attendance_records (
      session_id,
      email_hash,
      email_cipher
    )
    values (
      req.session_id,
      req.email_hash,
      req.email_cipher
    )
    on conflict (session_id, email_hash) do nothing;

    update public.roster_add_requests
    set status = 'added', resolved_at = now()
    where id = req.id;
  else
    update public.roster_add_requests
    set status = 'rejected', resolved_at = now()
    where id = req.id;
  end if;
end;
$$;

-- Promote existing allowlisted accounts that already signed up as faculty.
update public.profiles p
set role = 'advisor'
from private.advisor_emails a
where p.email = a.email
  and p.role <> 'advisor';

grant execute on function public.is_advisor() to authenticated;
grant execute on function public.can_manage_section(bigint) to authenticated;
grant execute on function public.can_manage_course(bigint) to authenticated;
