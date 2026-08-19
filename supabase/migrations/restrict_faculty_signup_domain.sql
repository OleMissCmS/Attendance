create or replace function private.is_faculty_email(p_email text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select
    p_email is not null
    and position('@' in p_email) > 1
    and lower(trim(p_email)) like '%@olemiss.edu'
    and lower(trim(p_email)) not like '%@go.olemiss.edu';
$$;

create or replace function private.may_create_staff_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.is_faculty_email(p_email)
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

  if private.is_faculty_email(email_norm) then
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
    where id = guest_id and role <> 'faculty';
  end if;
end;
$$;
