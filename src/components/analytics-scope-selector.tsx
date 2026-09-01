"use client"

import { useMemo, useState } from "react"
import { formatSectionLabel } from "@/lib/section-label"
import { Label } from "@/components/ui/label"
import type {
  AnalyticsCourseOption,
  AnalyticsScopeOption,
} from "@/lib/analytics-scope"
import { formatIdList } from "@/lib/analytics-scope"

const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm"

export function AnalyticsScopeSelector({
  courses,
  sections,
  defaultCourseIds,
  defaultSectionIds,
  period,
}: {
  courses: AnalyticsCourseOption[]
  sections: AnalyticsScopeOption[]
  defaultCourseIds: number[]
  defaultSectionIds: number[]
  period?: string
}) {
  const [courseIds, setCourseIds] = useState<number[]>(defaultCourseIds)
  const [sectionIds, setSectionIds] = useState<number[]>(defaultSectionIds)

  const visibleSections = useMemo(() => {
    if (!courseIds.length) return sections
    return sections.filter((section) => courseIds.includes(section.course_id))
  }, [courseIds, sections])

  const sectionsByCourse = useMemo(() => {
    const courseOrder = courses.map((course) => course.id)
    const grouped = new Map<number, AnalyticsScopeOption[]>()
    for (const section of visibleSections) {
      const list = grouped.get(section.course_id) ?? []
      list.push(section)
      grouped.set(section.course_id, list)
    }
    return courseOrder
      .filter((courseId) => grouped.has(courseId))
      .map((courseId) => ({
        course: courses.find((course) => course.id === courseId)!,
        sections: grouped.get(courseId)!,
      }))
  }, [courses, visibleSections])

  function toggleCourse(id: number) {
    setCourseIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  }

  function toggleSection(id: number) {
    setSectionIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    )
  }

  function selectAllCourses() {
    setCourseIds(courses.map((course) => course.id))
  }

  function clearCourses() {
    setCourseIds([])
  }

  function selectVisibleSections() {
    setSectionIds(visibleSections.map((section) => section.id))
  }

  function clearSections() {
    setSectionIds([])
  }

  return (
    <form method="get" className="space-y-4">
      {period ? <input type="hidden" name="period" value={period} /> : null}
      <input type="hidden" name="courses" value={formatIdList(courseIds)} />
      <input type="hidden" name="sections" value={formatIdList(sectionIds)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Courses</Label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="font-semibold text-[#000D26] underline-offset-4 hover:underline"
                onClick={selectAllCourses}
              >
                Select all
              </button>
              <button
                type="button"
                className="font-semibold text-[#333F58] underline-offset-4 hover:underline"
                onClick={clearCourses}
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty for all courses. Narrow sections with course picks.
          </p>
          <select
            multiple
            size={Math.min(8, Math.max(4, courses.length))}
            className={`${selectClass} min-h-[7rem] py-2`}
            value={courseIds.map(String)}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map(
                (option) => Number(option.value),
              )
              setCourseIds(selected)
            }}
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} {course.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Sections</Label>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className="font-semibold text-[#000D26] underline-offset-4 hover:underline"
                onClick={selectVisibleSections}
              >
                Select visible
              </button>
              <button
                type="button"
                className="font-semibold text-[#333F58] underline-offset-4 hover:underline"
                onClick={clearSections}
              >
                Clear
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty for all sections in scope. Hold Ctrl/Cmd to multi-select.
          </p>
          <select
            multiple
            size={Math.min(10, Math.max(4, visibleSections.length))}
            className={`${selectClass} min-h-[7rem] py-2`}
            value={sectionIds.map(String)}
            onChange={(event) => {
              const selected = Array.from(event.target.selectedOptions).map(
                (option) => Number(option.value),
              )
              setSectionIds(selected)
            }}
          >
            {sectionsByCourse.map(({ course, sections: courseSections }) => (
              <optgroup
                key={course.id}
                label={`${course.code} ${course.name}`}
              >
                {courseSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {formatSectionLabel(section)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md bg-[#000D26] px-4 text-sm font-bold text-white hover:bg-[#000D26]/90"
        >
          Apply scope
        </button>
        <a
          href={period ? `?period=${period}` : "."}
          className="text-sm font-bold text-[#333F58] underline-offset-4 hover:underline"
        >
          Reset to all courses & sections
        </a>
      </div>
    </form>
  )
}
