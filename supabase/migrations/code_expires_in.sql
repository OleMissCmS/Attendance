-- Remaining seconds until a classroom code is no longer accepted.
-- Window length comes from private.token_window_seconds() (15s).
create or replace function public.code_expires_in(
  p_session_id uuid,
  p_token text
)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  secret text;
  normalized_token text;
  w bigint;
  tw bigint;
  window_seconds integer := private.token_window_seconds();
  now_epoch double precision;
begin
  if p_session_id is null or p_token is null or length(trim(p_token)) = 0 then
    return 0;
  end if;

  if not exists (
    select 1 from public.attendance_sessions s
    where s.id = p_session_id and s.ended_at is null
  ) then
    return 0;
  end if;

  select token_secret into secret
  from private.session_secrets
  where session_id = p_session_id;

  if secret is null then
    return 0;
  end if;

  normalized_token := upper(trim(p_token));
  w := private.current_window();
  now_epoch := extract(epoch from clock_timestamp());

  if normalized_token = private.token_for_window(p_session_id, secret, w) then
    tw := w;
  elsif normalized_token = private.token_for_window(p_session_id, secret, w - 1) then
    tw := w - 1;
  else
    return 0;
  end if;

  return greatest(
    0,
    ceil(((tw + 2) * window_seconds) - now_epoch)::integer
  );
end;
$$;

grant execute on function public.code_expires_in(uuid, text) to anon, authenticated;

create or replace function public.session_display_code(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  secret text;
  w bigint;
  live boolean;
  window_seconds integer := private.token_window_seconds();
  now_epoch double precision;
begin
  select exists (
    select 1
    from public.attendance_sessions s
    join public.sections sec on sec.id = s.section_id
    where s.id = p_session_id
      and public.has_course_access(sec.course_id)
      and s.ended_at is null
  ) into live;

  if not live then
    raise exception 'Live session not found';
  end if;

  select token_secret into secret
  from private.session_secrets
  where session_id = p_session_id;

  w := private.current_window();
  now_epoch := extract(epoch from clock_timestamp());

  return jsonb_build_object(
    'code', private.token_for_window(p_session_id, secret, w),
    'window', w,
    'valid_seconds', window_seconds * 2,
    'expires_at', (w + 2) * window_seconds,
    'expires_in', greatest(0, ceil(((w + 2) * window_seconds) - now_epoch)::integer)
  );
end;
$$;
