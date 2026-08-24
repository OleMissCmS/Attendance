-- Allow guest and advisor roles on profiles (signup trigger assigns these).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role = any (array['faculty'::text, 'student'::text, 'guest'::text, 'advisor'::text]));
