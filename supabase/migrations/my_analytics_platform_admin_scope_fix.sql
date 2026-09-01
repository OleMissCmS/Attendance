-- My Analytics: platform admins see only owned + guest sections (advisors still see all).
-- Uses faculty-scope access (owner or section_members), not has_section_access which
-- also grants platform admins every section for support tooling.

create or replace function private.has_faculty_scope_section_access(p_section_id bigint)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
      select 1
      from public.sections s
      join public.courses c on c.id = s.course_id
      where s.id = p_section_id
        and s.deleted_at is null
        and c.deleted_at is null
        and c.faculty_id = auth.uid()
    )
    or exists (
      select 1
      from public.section_members m
      where m.section_id = p_section_id
        and m.user_id = auth.uid()
    );
$$;

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
        or private.has_faculty_scope_section_access(s.id)
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
        or private.has_faculty_scope_section_access(s.id)
      );
  elsif require_access then
    select coalesce(array_agg(s.id order by s.id), '{}'::bigint[])
    into resolved
    from public.sections s
    join public.courses c on c.id = s.course_id
    where s.deleted_at is null
      and c.deleted_at is null
      and private.has_faculty_scope_section_access(s.id);
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
