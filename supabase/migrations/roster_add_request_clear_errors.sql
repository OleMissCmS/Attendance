-- Clarify roster-add errors; do not require a live classroom code.
-- Ended sessions may still accept requests so students who proved presence
-- can finish the form after the faculty ends attendance.

create or replace function public.request_roster_addition(
  p_session_id uuid,
  p_email_hash text,
  p_email_cipher text,
  p_last_name_cipher text,
  p_first_name_cipher text,
  p_username_cipher text,
  p_student_id_cipher text,
  p_name_cipher text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_section bigint;
  enrolled boolean;
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

  select exists (
    select 1 from public.enrollments e
    where e.section_id = session_section and e.email_hash = p_email_hash
  ) into enrolled;

  if enrolled then
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
        status = 'pending',
        resolved_at = null,
        created_at = now()
    where public.roster_add_requests.status <> 'added';
end;
$$;
