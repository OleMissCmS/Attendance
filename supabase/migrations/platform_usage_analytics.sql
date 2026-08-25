-- Platform admin allowlist (usage analytics only; not advisor view-all).

create table if not exists private.platform_admin_emails (
  email text primary key
);

insert into private.platform_admin_emails (email)
values ('chads@olemiss.edu')
on conflict (email) do nothing;

create or replace function private.is_platform_admin_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from private.platform_admin_emails a
    where a.email = lower(trim(p_email))
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and private.is_platform_admin_email(p.email)
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- High-level platform usage metrics (counts/rates only; no student PII).
create or replace function public.platform_usage_stats()
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
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

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
  where sess.ended_at is not null;

  -- Platform attendance rate: sum over sections with ≥1 session of
  -- present / (roster × sessions), weighted by expected check-ins.
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
  ) sess on true
  left join lateral (
    select count(*)::int as present_count
    from public.attendance_records ar
    join public.attendance_sessions a on a.id = ar.session_id
    where a.section_id = s.id
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
    where started_at >= (timezone(tz, now())::date - 29)
      at time zone tz
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
    where ar.checked_in_at >= (timezone(tz, now())::date - 29)
      at time zone tz
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
          where ar.checked_in_at >= (timezone(tz, now())::date - 29)
            at time zone tz
          group by (ar.checked_in_at at time zone tz)::date
        ) c
      ),
      2
    )
  into avg_daily_sessions, avg_daily_checkins
  from (
    select count(*)::int as cnt
    from public.attendance_sessions
    where started_at >= (timezone(tz, now())::date - 29) at time zone tz
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
    where started_at >= (timezone(tz, now())::date - 29) at time zone tz
    group by 1
    order by sessions desc, day desc
    limit 1
  ) p
  left join (
    select
      (checked_in_at at time zone tz)::date as day,
      count(*)::int as checkins
    from public.attendance_records
    where checked_in_at >= (timezone(tz, now())::date - 29) at time zone tz
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
      'sessions_all_time', (
        select count(*)::int from public.attendance_sessions
      ),
      'sessions_7d', (
        select count(*)::int
        from public.attendance_sessions
        where started_at >= now() - interval '7 days'
      ),
      'sessions_30d', (
        select count(*)::int
        from public.attendance_sessions
        where started_at >= now() - interval '30 days'
      ),
      'live_sessions', (
        select count(*)::int
        from public.attendance_sessions
        where ended_at is null
      ),
      'avg_session_minutes', avg_session_minutes,
      'checkins_all_time', (
        select count(*)::int from public.attendance_records
      ),
      'checkins_7d', (
        select count(*)::int
        from public.attendance_records
        where checked_in_at >= now() - interval '7 days'
      ),
      'checkins_30d', (
        select count(*)::int
        from public.attendance_records
        where checked_in_at >= now() - interval '30 days'
      ),
      'avg_attendance_rate', attendance_rate,
      'expected_checkins', expected_checkins::bigint,
      'present_checkins', present_checkins::bigint,
      'avg_daily_sessions_30d', avg_daily_sessions,
      'avg_daily_checkins_30d', avg_daily_checkins,
      'peak_day_30d', peak
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
      'sessions_per_day_30d', sessions_by_day,
      'checkins_per_day_30d', checkins_by_day,
      'faculty_signups_per_week_12w', faculty_by_week
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.platform_usage_stats() to authenticated;
