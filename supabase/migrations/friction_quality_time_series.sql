-- My Analytics: platform admins see own courses only (advisors still see all).
-- Friction / quality daily time series for admin and faculty analytics.

create or replace function private.resolve_analytics_section_ids(
  p_course_ids bigint[] default null,
  p_section_ids bigint[] default null,
  p_require_access boolean default false
)
returns bigint[]
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  resolved bigint[];
  require_access boolean := p_require_access;
begin
  if p_require_access and public.is_advisor() then
    require_access := false;
  end if;

  if p_section_ids is not null and cardinality(p_section_ids) > 0 then
    select coalesce(array_agg(s.id order by s.id), '{}'::bigint[])
    into resolved
    from public.sections s
    join public.courses c on c.id = s.course_id
    where s.id = any(p_section_ids)
      and s.deleted_at is null
      and c.deleted_at is null
      and (
        not require_access
        or public.has_section_access(s.id)
      )
      and (
        p_course_ids is null
        or cardinality(p_course_ids) = 0
        or c.id = any(p_course_ids)
      );
  elsif p_course_ids is not null and cardinality(p_course_ids) > 0 then
    select coalesce(array_agg(s.id order by s.id), '{}'::bigint[])
    into resolved
    from public.sections s
    join public.courses c on c.id = s.course_id
    where c.id = any(p_course_ids)
      and s.deleted_at is null
      and c.deleted_at is null
      and (
        not require_access
        or public.has_section_access(s.id)
      );
  elsif require_access then
    select coalesce(array_agg(s.id order by s.id), '{}'::bigint[])
    into resolved
    from public.sections s
    join public.courses c on c.id = s.course_id
    where s.deleted_at is null
      and c.deleted_at is null
      and public.has_section_access(s.id);
  else
    select coalesce(array_agg(s.id order by s.id), '{}'::bigint[])
    into resolved
    from public.sections s
    join public.courses c on c.id = s.course_id
    where s.deleted_at is null
      and c.deleted_at is null;
  end if;

  return coalesce(resolved, '{}'::bigint[]);
end;
$$;

create or replace function private.scoped_friction_stats(
  p_period_start timestamptz,
  p_section_ids bigint[],
  p_tz text default 'America/Chicago'
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  scoped_sections bigint[] := coalesce(p_section_ids, '{}'::bigint[]);
  per_day jsonb;
  roster_req jsonb;
  roster_miss int;
  incognito int;
  incognito_rate numeric;
  late_flags int;
  conflict_flags int;
begin
  select coalesce(jsonb_object_agg(status, cnt), '{}'::jsonb)
  into roster_req
  from (
    select status, count(*)::int as cnt
    from public.roster_add_requests r
    where r.created_at >= p_period_start
      and (
        cardinality(scoped_sections) = 0
        or r.section_id = any(scoped_sections)
      )
    group by status
  ) x;

  select count(*)::int
  into roster_miss
  from public.roster_miss_attempts r
  where r.created_at >= p_period_start
    and (
      cardinality(scoped_sections) = 0
      or r.section_id = any(scoped_sections)
    );

  select
    count(*) filter (where ar.is_incognito)::int,
    case
      when count(*) = 0 then null
      else round(
        count(*) filter (where ar.is_incognito)::numeric / count(*)::numeric,
        4
      )
    end
  into incognito, incognito_rate
  from public.attendance_records ar
  join public.attendance_sessions sess on sess.id = ar.session_id
  where ar.checked_in_at >= p_period_start
    and (
      cardinality(scoped_sections) = 0
      or sess.section_id = any(scoped_sections)
    );

  select count(*)::int
  into late_flags
  from public.attendance_flags f
  where f.flag_type = 'late_device'
    and f.created_at >= p_period_start
    and (
      cardinality(scoped_sections) = 0
      or f.section_id = any(scoped_sections)
    );

  select count(*)::int
  into conflict_flags
  from public.attendance_flags f
  where f.flag_type = 'device_conflict'
    and f.created_at >= p_period_start
    and (
      cardinality(scoped_sections) = 0
      or f.section_id = any(scoped_sections)
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', d.day,
        'roster_add_requests', coalesce(ra.cnt, 0),
        'roster_miss_attempts', coalesce(rm.cnt, 0),
        'incognito_checkins', coalesce(inc.cnt, 0),
        'device_flags', coalesce(df.cnt, 0)
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into per_day
  from (
    select distinct day
    from (
      select (r.created_at at time zone p_tz)::date as day
      from public.roster_add_requests r
      where r.created_at >= p_period_start
        and (
          cardinality(scoped_sections) = 0
          or r.section_id = any(scoped_sections)
        )
      union
      select (r.created_at at time zone p_tz)::date as day
      from public.roster_miss_attempts r
      where r.created_at >= p_period_start
        and (
          cardinality(scoped_sections) = 0
          or r.section_id = any(scoped_sections)
        )
      union
      select (ar.checked_in_at at time zone p_tz)::date as day
      from public.attendance_records ar
      join public.attendance_sessions sess on sess.id = ar.session_id
      where ar.checked_in_at >= p_period_start
        and ar.is_incognito = true
        and (
          cardinality(scoped_sections) = 0
          or sess.section_id = any(scoped_sections)
        )
      union
      select (f.created_at at time zone p_tz)::date as day
      from public.attendance_flags f
      where f.created_at >= p_period_start
        and (
          cardinality(scoped_sections) = 0
          or f.section_id = any(scoped_sections)
        )
    ) active_days
  ) d
  left join (
    select
      (r.created_at at time zone p_tz)::date as day,
      count(*)::int as cnt
    from public.roster_add_requests r
    where r.created_at >= p_period_start
      and (
        cardinality(scoped_sections) = 0
        or r.section_id = any(scoped_sections)
      )
    group by 1
  ) ra on ra.day = d.day
  left join (
    select
      (r.created_at at time zone p_tz)::date as day,
      count(*)::int as cnt
    from public.roster_miss_attempts r
    where r.created_at >= p_period_start
      and (
        cardinality(scoped_sections) = 0
        or r.section_id = any(scoped_sections)
      )
    group by 1
  ) rm on rm.day = d.day
  left join (
    select
      (ar.checked_in_at at time zone p_tz)::date as day,
      count(*)::int as cnt
    from public.attendance_records ar
    join public.attendance_sessions sess on sess.id = ar.session_id
    where ar.checked_in_at >= p_period_start
      and ar.is_incognito = true
      and (
        cardinality(scoped_sections) = 0
        or sess.section_id = any(scoped_sections)
      )
    group by 1
  ) inc on inc.day = d.day
  left join (
    select
      (f.created_at at time zone p_tz)::date as day,
      count(*)::int as cnt
    from public.attendance_flags f
    where f.created_at >= p_period_start
      and (
        cardinality(scoped_sections) = 0
        or f.section_id = any(scoped_sections)
      )
    group by 1
  ) df on df.day = d.day;

  return jsonb_build_object(
    'totals', jsonb_build_object(
      'roster_add_by_status', roster_req,
      'roster_miss_attempts', roster_miss,
      'incognito_checkins', incognito,
      'incognito_rate', incognito_rate,
      'late_device_flags', late_flags,
      'device_conflict_flags', conflict_flags
    ),
    'per_day', per_day
  );
end;
$$;

-- Patch scoped_attendance_usage_stats to append friction_per_day series.
do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'scoped_attendance_usage_stats_core'
  ) then
    execute (
      select format(
        'alter function private.scoped_attendance_usage_stats(%s) rename to scoped_attendance_usage_stats_core',
        pg_get_function_identity_arguments(p.oid)
      )
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private'
        and p.proname = 'scoped_attendance_usage_stats'
      limit 1
    );
  end if;
end;
$$;

create or replace function private.scoped_attendance_usage_stats(
  p_period text,
  p_section_ids bigint[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  base jsonb;
  friction jsonb;
  period_start timestamptz;
  scoped_sections bigint[] := coalesce(p_section_ids, '{}'::bigint[]);
begin
  base := private.scoped_attendance_usage_stats_core(p_period, p_section_ids);
  period_start := (base->'period'->>'start')::timestamptz;
  friction := private.scoped_friction_stats(period_start, scoped_sections);

  return jsonb_set(
    jsonb_set(
      base,
      '{series,friction_per_day}',
      friction->'per_day',
      true
    ),
    '{friction}',
    friction->'totals',
    true
  );
end;
$$;

create or replace function public.platform_usage_stats(
  p_period text default 'month',
  p_course_ids bigint[] default null,
  p_section_ids bigint[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  result jsonb;
  scoped jsonb;
  scoped_sections bigint[];
  friction jsonb;
  period_start timestamptz;
  avg_roster numeric := null;
  roles jsonb;
  faculty_by_week jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  scoped_sections := private.resolve_analytics_section_ids(
    p_course_ids,
    p_section_ids,
    false
  );

  scoped := private.scoped_attendance_usage_stats(p_period, scoped_sections);
  period_start := (scoped->'period'->>'start')::timestamptz;
  friction := private.scoped_friction_stats(period_start, scoped_sections);

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

  select coalesce(jsonb_object_agg(role, cnt), '{}'::jsonb)
  into roles
  from (
    select role, count(*)::int as cnt
    from public.profiles
    where role in ('faculty', 'guest', 'advisor')
    group by role
  ) r;

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
      date_trunc('week', created_at at time zone 'America/Chicago')::date as week_start,
      count(*)::int as cnt
    from public.profiles
    where role = 'faculty'
      and created_at >= (timezone('America/Chicago', now())::date - (12 * 7))
        at time zone 'America/Chicago'
    group by 1
  ) w;

  select jsonb_build_object(
    'generated_at', scoped->'generated_at',
    'period', scoped->'period',
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
    'attendance', scoped->'attendance',
    'friction', friction->'totals',
    'series', jsonb_build_object(
      'sessions_per_day', scoped->'series'->'sessions_per_day',
      'checkins_per_day', scoped->'series'->'checkins_per_day',
      'checkins_vs_expected_per_day', scoped->'series'->'checkins_vs_expected_per_day',
      'faculty_signups_per_week_12w', faculty_by_week,
      'friction_per_day', friction->'per_day'
    )
  )
  into result;

  return result;
end;
$$;

grant execute on function public.platform_usage_stats(text, bigint[], bigint[]) to authenticated;
