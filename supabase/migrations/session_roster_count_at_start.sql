-- Snapshot roster size when a session starts so analytics expected check-ins
-- reflect enrollment at session time, not the live roster after sync changes.

alter table public.attendance_sessions
  add column if not exists roster_count_at_start int;

comment on column public.attendance_sessions.roster_count_at_start is
  'Enrollment count for the section when this session was started.';

create or replace function public.start_session(p_section_id bigint)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  new_id uuid;
  secret text;
  roster_count int;
begin
  if not public.can_manage_section(p_section_id) then
    raise exception 'Not authorized';
  end if;

  if exists (
    select 1 from public.sections s
    join public.courses c on c.id = s.course_id
    where s.id = p_section_id
      and (s.deleted_at is not null or c.deleted_at is not null)
  ) then
    raise exception 'Section is archived';
  end if;

  if exists (
    select 1 from public.attendance_sessions
    where section_id = p_section_id and ended_at is null
  ) then
    raise exception 'A live session already exists for this section';
  end if;

  select count(*)::int
  into roster_count
  from public.enrollments e
  where e.section_id = p_section_id;

  secret := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.attendance_sessions (
    section_id,
    started_by,
    roster_count_at_start
  )
  values (p_section_id, auth.uid(), roster_count)
  returning id into new_id;

  insert into private.session_secrets (session_id, token_secret)
  values (new_id, secret);

  return new_id;
end;
$$;

-- Best-effort backfill for existing sessions: prefer enrollments that existed
-- at session start, but never undercount vs distinct check-ins that day.
update public.attendance_sessions a
set roster_count_at_start = greatest(
  coalesce((
    select count(*)::int
    from public.enrollments e
    where e.section_id = a.section_id
      and e.created_at <= a.started_at
  ), 0),
  coalesce((
    select count(distinct ar.email_hash)::int
    from public.attendance_records ar
    where ar.session_id = a.id
  ), 0)
)
where a.roster_count_at_start is null;

create or replace function private.session_roster_count(p_session public.attendance_sessions)
returns int
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    p_session.roster_count_at_start,
    (
      select count(*)::int
      from public.enrollments e
      where e.section_id = p_session.section_id
    ),
    0
  );
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
  tz text := 'America/Chicago';
  expected_checkins numeric := 0;
  present_checkins numeric := 0;
  attendance_rate numeric := null;
  avg_session_minutes numeric := null;
  avg_daily_sessions numeric := null;
  avg_daily_checkins numeric := null;
  peak jsonb := null;
  sessions_by_day jsonb;
  checkins_by_day jsonb;
  checkins_vs_expected_by_day jsonb;
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
  scoped_sections bigint[] := coalesce(p_section_ids, '{}'::bigint[]);
begin
  period_key := lower(trim(coalesce(p_period, 'month')));
  if period_key not in ('week', 'month', 'year', 'semester') then
    period_key := 'month';
  end if;

  local_today := (timezone(tz, period_end))::date;
  local_month := extract(month from timezone(tz, period_end))::int;
  local_year := extract(year from timezone(tz, period_end))::int;

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

  select s.term
  into semester_term_label
  from public.sections s
  join public.courses c on c.id = s.course_id
  where s.deleted_at is null
    and c.deleted_at is null
    and (
      cardinality(scoped_sections) = 0
      or s.id = any(scoped_sections)
    )
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

  select round(
    avg(extract(epoch from (sess.ended_at - sess.started_at)) / 60.0)::numeric,
    1
  )
  into avg_session_minutes
  from public.attendance_sessions sess
  where sess.ended_at is not null
    and sess.started_at >= period_start
    and (
      cardinality(scoped_sections) = 0
      or sess.section_id = any(scoped_sections)
    );

  select
    coalesce(sum(private.session_roster_count(a)) filter (where a.id is not null), 0),
    coalesce(sum(pres.present_count), 0)
  into expected_checkins, present_checkins
  from public.sections s
  join public.courses c on c.id = s.course_id
  join lateral (
    select a.*
    from public.attendance_sessions a
    where a.section_id = s.id
      and a.started_at >= period_start
  ) a on true
  left join lateral (
    select count(*)::int as present_count
    from public.attendance_records ar
    where ar.session_id = a.id
  ) pres on true
  where s.deleted_at is null
    and c.deleted_at is null
    and private.session_roster_count(a) > 0
    and (
      cardinality(scoped_sections) = 0
      or s.id = any(scoped_sections)
    );

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
      and (
        cardinality(scoped_sections) = 0
        or section_id = any(scoped_sections)
      )
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
    join public.attendance_sessions sess on sess.id = ar.session_id
    where ar.checked_in_at >= period_start
      and (
        cardinality(scoped_sections) = 0
        or sess.section_id = any(scoped_sections)
      )
    group by 1
  ) d;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', d.day,
        'actual', coalesce(a.actual, 0),
        'expected', coalesce(e.expected, 0)
      )
      order by d.day
    ),
    '[]'::jsonb
  )
  into checkins_vs_expected_by_day
  from (
    select distinct day
    from (
      select (started_at at time zone tz)::date as day
      from public.attendance_sessions
      where started_at >= period_start
        and (
          cardinality(scoped_sections) = 0
          or section_id = any(scoped_sections)
        )
      union
      select (ar.checked_in_at at time zone tz)::date as day
      from public.attendance_records ar
      join public.attendance_sessions sess on sess.id = ar.session_id
      where ar.checked_in_at >= period_start
        and (
          cardinality(scoped_sections) = 0
          or sess.section_id = any(scoped_sections)
        )
    ) active_days
  ) d
  left join (
    select
      (ar.checked_in_at at time zone tz)::date as day,
      count(*)::int as actual
    from public.attendance_records ar
    join public.attendance_sessions sess on sess.id = ar.session_id
    where ar.checked_in_at >= period_start
      and (
        cardinality(scoped_sections) = 0
        or sess.section_id = any(scoped_sections)
      )
    group by 1
  ) a on a.day = d.day
  left join (
    select
      (a.started_at at time zone tz)::date as day,
      coalesce(sum(private.session_roster_count(a)), 0)::int as expected
    from public.attendance_sessions a
    where a.started_at >= period_start
      and (
        cardinality(scoped_sections) = 0
        or a.section_id = any(scoped_sections)
      )
    group by 1
  ) e on e.day = d.day;

  select
    round(avg(cnt)::numeric, 2),
    round(
      (
        select avg(c.cnt)::numeric
        from (
          select count(*)::int as cnt
          from public.attendance_records ar
          join public.attendance_sessions sess on sess.id = ar.session_id
          where ar.checked_in_at >= period_start
            and (
              cardinality(scoped_sections) = 0
              or sess.section_id = any(scoped_sections)
            )
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
      and (
        cardinality(scoped_sections) = 0
        or section_id = any(scoped_sections)
      )
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
      and (
        cardinality(scoped_sections) = 0
        or section_id = any(scoped_sections)
      )
    group by 1
    order by sessions desc, day desc
    limit 1
  ) p
  left join (
    select
      (checked_in_at at time zone tz)::date as day,
      count(*)::int as checkins
    from public.attendance_records ar
    join public.attendance_sessions sess on sess.id = ar.session_id
    where checked_in_at >= period_start
      and (
        cardinality(scoped_sections) = 0
        or sess.section_id = any(scoped_sections)
      )
    group by 1
  ) c on c.day = p.day;

  return jsonb_build_object(
    'generated_at', now(),
    'period', jsonb_build_object(
      'key', period_key,
      'label', period_label,
      'start', period_start,
      'days', period_days
    ),
    'attendance', jsonb_build_object(
      'sessions', (
        select count(*)::int
        from public.attendance_sessions
        where started_at >= period_start
          and (
            cardinality(scoped_sections) = 0
            or section_id = any(scoped_sections)
          )
      ),
      'live_sessions', (
        select count(*)::int
        from public.attendance_sessions
        where ended_at is null
          and started_at >= period_start
          and (
            cardinality(scoped_sections) = 0
            or section_id = any(scoped_sections)
          )
      ),
      'avg_session_minutes', avg_session_minutes,
      'checkins', (
        select count(*)::int
        from public.attendance_records ar
        join public.attendance_sessions sess on sess.id = ar.session_id
        where ar.checked_in_at >= period_start
          and (
            cardinality(scoped_sections) = 0
            or sess.section_id = any(scoped_sections)
          )
      ),
      'avg_attendance_rate', attendance_rate,
      'expected_checkins', expected_checkins::bigint,
      'present_checkins', present_checkins::bigint,
      'avg_daily_sessions', avg_daily_sessions,
      'avg_daily_checkins', avg_daily_checkins,
      'peak_day', peak
    ),
    'series', jsonb_build_object(
      'sessions_per_day', sessions_by_day,
      'checkins_per_day', checkins_by_day,
      'checkins_vs_expected_per_day', checkins_vs_expected_by_day
    )
  );
end;
$$;
