create table if not exists private.login_lockouts (
  email text primary key,
  failed_count integer not null default 0,
  locked_at timestamptz
);

alter table private.login_lockouts enable row level security;

revoke all on table private.login_lockouts from public, anon, authenticated;

create or replace function private.login_is_locked(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from private.login_lockouts l
    where l.email = lower(trim(p_email))
      and l.locked_at is not null
  );
$$;

create or replace function private.record_failed_login(p_email text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  email_norm text := lower(trim(p_email));
  now_locked boolean := false;
begin
  if email_norm is null or email_norm = '' then
    return false;
  end if;

  if not exists (
    select 1 from public.profiles p where p.email = email_norm
  ) then
    return false;
  end if;

  insert into private.login_lockouts as l (email, failed_count, locked_at)
  values (
    email_norm,
    1,
    null
  )
  on conflict (email) do update
    set failed_count = l.failed_count + 1,
        locked_at = case
          when l.locked_at is not null then l.locked_at
          when l.failed_count + 1 > 10 then now()
          else null
        end;

  select l.locked_at is not null
    into now_locked
  from private.login_lockouts l
  where l.email = email_norm;

  return coalesce(now_locked, false);
end;
$$;

create or replace function private.clear_own_login_failures()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  email_norm text := lower(trim(auth.email()));
begin
  if email_norm is null or email_norm = '' then
    return;
  end if;

  delete from private.login_lockouts
  where email = email_norm
    and locked_at is null;
end;
$$;

create or replace function private.unlock_login_lockout_on_password_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password then
    delete from private.login_lockouts
    where email = lower(trim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists unlock_login_lockout_on_password_change on auth.users;

create trigger unlock_login_lockout_on_password_change
after update on auth.users
for each row
execute function private.unlock_login_lockout_on_password_change();

create or replace function public.login_is_locked(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.login_is_locked(p_email);
$$;

create or replace function public.record_failed_login(p_email text)
returns boolean
language sql
security definer
set search_path to ''
as $$
  select private.record_failed_login(p_email);
$$;

create or replace function public.clear_own_login_failures()
returns void
language sql
security definer
set search_path to ''
as $$
  select private.clear_own_login_failures();
$$;

revoke all on function private.login_is_locked(text) from public, anon, authenticated;
revoke all on function private.record_failed_login(text) from public, anon, authenticated;
revoke all on function private.clear_own_login_failures() from public, anon, authenticated;
revoke all on function private.unlock_login_lockout_on_password_change() from public, anon, authenticated;

revoke all on function public.login_is_locked(text) from public, anon, authenticated;
revoke all on function public.record_failed_login(text) from public, anon, authenticated;
revoke all on function public.clear_own_login_failures() from public, anon, authenticated;

grant execute on function public.login_is_locked(text) to anon, authenticated;
grant execute on function public.record_failed_login(text) to anon, authenticated;
grant execute on function public.clear_own_login_failures() to authenticated;
