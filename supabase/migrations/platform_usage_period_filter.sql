-- Add time-period filtering to platform attendance usage analytics.

drop function if exists public.platform_usage_stats();

create or replace function public.platform_usage_stats(p_period text default 'month')
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  tz text := 'America/Chicago';
  result jsonb;
  expected_checkins numeric := 0;
  present_checkins numeric := 0;
  attendance_rate numeric := null;
  avg_roster numeric := null;
  avg_session_minutes numeric := null;
  avg_daily_sessions numeric := null;
  avg_daily_checkins numeric := null;
  peak jsonb := null;
  sessions_by_day jsonb;
  checkins_by_day jsonb;
  faculty_by_week jsonb;
  roles jsonb;
  roster_req jsonb;
  period_key text;
  period_start timestamptz;
  period_end timestamptz := now();
  local_today date;
  local_month int;
  local_year int;
  semester_start date;
  semester_name text;
  semester_term_label text;
  period_days int;
  period_label text;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  period_key := lower(trim(coalesce(p_period, 'month')));
  if period_key not in ('week', 'month', 'year', 'semester') then
    period_key := 'month';
  end if;

  local_today := (timezone(tz, period_end))::date;
  local_month := extract(month from timezone(tz, period_end))::int;
  local_year := extract(year from timezone(tz, period_end))::int;

  -- Calendar-based academic semester boundaries (US-style):
  -- Spring Jan–May, Summer Jun–Jul, Fall Aug–Dec.
  if local_month between 1 and 5 then
    semester_start := make_date(local_year, 1, 1);
    semester_name := 'Spring';
  elsif local_month between 6 and 7 then
    semester_start := make_date(local_year, 6, 1);
    semester_name := 'Summer';
  else
    semester_start := make_date(local_year, 8, 1);
    semester_name := 'Fall';
  end if;

  -- Prefer a matching term label from active sections when available
  -- (e.g. "Fall 2026") for display; date bounds stay calendar-based.
  select s.term
  into semester_term_label
  from public.sections s
  join public.courses c on c.id = s.course_id
  where s.deleted_at is null
    and c.deleted_at is null
    and s.term ~* ('^' || semester_name || '\s+' || local_year::text || '\s*$')
  group by s.term
  order by count(*) desc, s.term
  limit 1;

  case period_key
    when 'week' then
      period_start := period_end - interval '7 days';
      period_days := 7;
      period_label := 'Last week';
    when 'month' then
      period_start := period_end - interval '30 days';
      period_days := 30;
      period_label := 'Last month';
    when 'year' then
      period_start := period_end - interval '365 days';
      period_days := 365;
      period_label := 'Last year';
    when 'semester' then
      period_start := semester_start at time zone tz;
      period_days := greatest(1, local_today - semester_start + 1);
      period_label := coalesce(
        semester_term_label,
        semester_name || ' ' || local_year::text
      );
    else
      period_start := period_end - interval '30 days';
      period_days := 30;
      period_label := 'Last month';
  end case;

  select coalesce(jsonb_object_agg(role, cnt), '{}'::jsonb)
  into roles
  from (
    select role, count(*)::int as cnt
    from public.profiles
    where role in ('faculty', 'guest', 'advisor')
    group by role
  ) r;

  select
    case
      when count(*) filter (where s.deleted_at is null) = 0 then null
      else round(
        count(e.id)::numeric
          / nullif(count(distinct s.id) filter (where s.deleted_at is null), 0),
        1
      )
    end
  into avg_roster
  from public.sections s
  left join public.enrollments e on e.section_id = s.id;

  select round(
    avg(extract(epoch from (sess.ended_at - sess.started_at)) / 60.0)::numeric,
    1
  )
  into avg_session_minutes
  from public.attendance_sessions sess
  where sess.ended_at is not null
    and sess.started_at >= period_start;

  -- Attendance rate for the selected window: present / (roster × sessions).
  select
    coalesce(sum(enr.roster_count * sess.session_count), 0),
    coalesce(sum(pres.present_count), 0)
  into expected_checkins, present_checkins
  from public.sections s
  join public.courses c on c.id = s.course_id
  join lateral (
    select count(*)::int as roster_count
    from public.enrollments e
    where e.section_id = s.id
  ) enr on true
  join lateral (
    select count(*)::int as session_count
    from public.attendance_sessions a
    where a.section_id = s.id
      and a.started_at >= period_start
  ) sess on true
  left join lateral (
    select count(*)::int as present_count
    from public.attendance_records ar
    join public.attendance_sessions a on a.id = ar.session_id
    where a.section_id = s.id
      and a.started_at >= period_start
  ) pres on true
  where s.deleted_at is null
    and c.deleted_at is null
    and sess.session_count > 0
    and enr.roster_count > 0;

  if expected_checkins > 0 then
    attendance_rate := round(present_checkins / expected_checkins, 4);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('date', d.day, 'count', d.cnt)
      order by d.day
    ),
    '[]'::jsonb
  )
  into sessions_by_day
  from (
    select
      (started_at at time zone tz)::date as day,
      count(*)::int as cnt
    from public.attendance_sessions
    where started_at >= period_start
    group by 1
  ) d;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('date', d.day, 'count', d.cnt)
      order by d.day
    ),
    '[]'::jsonb
  )
  into checkins_by_day
  from (
    select
      (ar.checked_in_at at time zone tz)::date as day,
      count(*)::int as cnt
    from public.attendance_records ar
    where ar.checked_in_at >= period_start
    group by 1
  ) d;

  select
    round(avg(cnt)::numeric, 2),
    round(
      (
        select avg(c.cnt)::numeric
        from (
          select count(*)::int as cnt
          from public.attendance_records ar
          where ar.checked_in_at >= period_start
          group by (ar.checked_in_at at time zone tz)::date
        ) c
      ),
      2
    )
  into avg_daily_sessions, avg_daily_checkins
  from (
    select count(*)::int as cnt
    from public.attendance_sessions
    where started_at >= period_start
    group by (started_at at time zone tz)::date
  ) s;

  select jsonb_build_object(
    'date', p.day,
    'sessions', p.sessions,
    'checkins', coalesce(c.checkins, 0)
  )
  into peak
  from (
    select
      (started_at at time zone tz)::date as day,
      count(*)::int as sessions
    from public.attendance_sessions
    where started_at >= period_start
    group by 1
    order by sessions desc, day desc
    limit 1
  ) p
  left join (
    select
      (checked_in_at at time zone tz)::date as day,
      count(*)::int as checkins
    from public.attendance_records
    where checked_in_at >= period_start
    group by 1
  ) c on c.day = p.day;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('week_start', w.week_start, 'count', w.cnt)
      order by w.week_start
    ),
    '[]'::jsonb
  )
  into faculty_by_week
  from (
    select
      date_trunc('week', created_at at time zone tz)::date as week_start,
      count(*)::int as cnt
    from public.profiles
    where role = 'faculty'
      and created_at >= (timezone(tz, now())::date - (12 * 7))
        at time zone tz
    group by 1
  ) w;

  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
  into roster_req
  from (
    select status, count(*)::int as cnt
    from public.roster_add_requests
    group by status
  ) x;

  select jsonb_build_object(
    'generated_at', now(),
    'period', jsonb_build_object(
      'key', period_key,
      'label', period_label,
      'start', period_start,
      'days', period_days
    ),
    'adoption', jsonb_build_object(
      'accounts_by_role', roles,
      'faculty_with_course', (
        select count(distinct c.faculty_id)::int
        from public.courses c
        where c.deleted_at is null
      ),
      'faculty_with_session', (
        select count(distinct c.faculty_id)::int
        from public.attendance_sessions s
        join public.sections sec on sec.id = s.section_id
        join public.courses c on c.id = sec.course_id
      ),
      'new_faculty_7d', (
        select count(*)::int
        from public.profiles
        where role = 'faculty'
          and created_at >= now() - interval '7 days'
      ),
      'new_faculty_30d', (
        select count(*)::int
        from public.profiles
        where role = 'faculty'
          and created_at >= now() - interval '30 days'
      ),
      'guest_invites', (
        select count(*)::int from public.section_members
      )
    ),
    'catalog', jsonb_build_object(
      'active_courses', (
        select count(*)::int from public.courses where deleted_at is null
      ),
      'archived_courses', (
        select count(*)::int from public.courses where deleted_at is not null
      ),
      'active_sections', (
        select count(*)::int from public.sections where deleted_at is null
      ),
      'archived_sections', (
        select count(*)::int from public.sections where deleted_at is not null
      ),
      'roster_seats', (
        select count(*)::int from public.enrollments
      ),
      'avg_roster_per_section', avg_roster
    ),
    'attendance', jsonb_build_object(
      'sessions', (
        select count(*)::int
        from public.attendance_sessions
        where started_at >= period_start
      ),
      'live_sessions', (
        select count(*)::int
        from public.attendance_sessions
        where ended_at is null
          and started_at >= period_start
      ),
      'avg_session_minutes', avg_session_minutes,
      'checkins', (
        select count(*)::int
        from public.attendance_records
        where checked_in_at >= period_start
      ),
      'avg_attendance_rate', attendance_rate,
      'expected_checkins', expected_checkins::bigint,
      'present_checkins', present_checkins::bigint,
      'avg_daily_sessions', avg_daily_sessions,
      'avg_daily_checkins', avg_daily_checkins,
      'peak_day', peak
    ),
    'friction', jsonb_build_object(
      'roster_add_by_status', roster_req,
      'roster_miss_attempts', (
        select count(*)::int from public.roster_miss_attempts
      ),
      'incognito_checkins', (
        select count(*)::int
        from public.attendance_records
        where is_incognito = true
      ),
      'incognito_rate', (
        select case
          when count(*) = 0 then null
          else round(
            count(*) filter (where is_incognito)::numeric / count(*)::numeric,
            4
          )
        end
        from public.attendance_records
      ),
      'late_device_flags', (
        select count(*)::int
        from public.attendance_flags
        where flag_type = 'late_device'
      ),
      'device_conflict_flags', (
        select count(*)::int
        from public.attendance_flags
        where flag_type = 'device_conflict'
      )
    ),
    'series', jsonb_build_object(
      'sessions_per_day', sessions_by_day,
      'checkins_per_day', checkins_by_day,
      'faculty_signups_per_week_12w', faculty_by_week
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.platform_usage_stats(text) to authenticated;
