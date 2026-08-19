create table if not exists public.roster_add_requests (
  id bigint generated always as identity primary key,
  section_id bigint not null references public.sections(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  email_hash text not null,
  email_cipher text not null,
  last_name_cipher text,
  first_name_cipher text,
  username_cipher text,
  student_id_cipher text,
  name_cipher text,
  status text not null default 'pending' check (status in ('pending', 'added', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (section_id, email_hash)
);

alter table public.roster_add_requests enable row level security;

create policy roster_add_requests_select on public.roster_add_requests
  for select using (public.has_section_access(section_id));

grant select on public.roster_add_requests to authenticated;
