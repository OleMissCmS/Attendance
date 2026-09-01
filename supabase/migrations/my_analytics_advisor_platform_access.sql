-- My Analytics: advisors and platform admins see all active sections by default.

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
  if p_require_access and (public.is_advisor() or public.is_platform_admin()) then
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

create or replace function public.faculty_usage_stats(
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
  scoped_sections bigint[];
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('faculty', 'guest', 'advisor')
    )
    or public.is_platform_admin()
  ) then
    raise exception 'not authorized';
  end if;

  scoped_sections := private.resolve_analytics_section_ids(
    p_course_ids,
    p_section_ids,
    true
  );

  return private.scoped_attendance_usage_stats(p_period, scoped_sections);
end;
$$;

grant execute on function public.faculty_usage_stats(text, bigint[], bigint[]) to authenticated;
