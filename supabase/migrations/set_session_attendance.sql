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

  if not public.has_section_access(session_section) then
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

grant execute on function public.set_session_attendance(uuid, text, boolean) to authenticated;
