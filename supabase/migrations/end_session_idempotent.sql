-- Make end_session idempotent: already-ended sessions succeed for authorized callers.
-- Prevents double-click "End session" from raising and showing a false error page.

create or replace function public.end_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  session_course bigint;
  session_ended timestamptz;
begin
  select sec.course_id, s.ended_at
  into session_course, session_ended
  from public.attendance_sessions s
  join public.sections sec on sec.id = s.section_id
  where s.id = p_session_id;

  if session_course is null then
    raise exception 'Session not found or already ended';
  end if;

  if not public.can_manage_course(session_course) then
    raise exception 'Session not found or already ended';
  end if;

  -- Already ended: treat as success (idempotent for double-submit).
  if session_ended is not null then
    return;
  end if;

  update public.attendance_sessions
  set ended_at = now()
  where id = p_session_id
    and ended_at is null;

  if not found then
    -- Concurrent end won the race; still success.
    return;
  end if;
end;
$$;
