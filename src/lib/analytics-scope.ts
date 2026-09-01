export type AnalyticsScopeOption = {
  id: number
  course_id: number
  courseCode: string
  courseName: string
  term?: string | null
  section_number?: string | null
  label?: string | null
}

export type AnalyticsCourseOption = {
  id: number
  code: string
  name: string
}

export function parseIdList(value: string | undefined | null): number[] {
  if (!value?.trim()) return []
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0)
}

export function formatIdList(ids: number[]): string {
  return ids.join(",")
}

export function resolveAnalyticsSectionIds(
  sections: AnalyticsScopeOption[],
  courseIds: number[],
  sectionIds: number[],
): number[] {
  let scoped = sections
  if (sectionIds.length) {
    scoped = scoped.filter((section) => sectionIds.includes(section.id))
  }
  if (courseIds.length) {
    scoped = scoped.filter((section) => courseIds.includes(section.course_id))
  }
  return scoped.map((section) => section.id)
}

export function buildAnalyticsScopeSearchParams(input: {
  period?: string
  courses?: number[]
  sections?: number[]
}): URLSearchParams {
  const params = new URLSearchParams()
  if (input.period) params.set("period", input.period)
  if (input.courses?.length) params.set("courses", formatIdList(input.courses))
  if (input.sections?.length) params.set("sections", formatIdList(input.sections))
  return params
}
