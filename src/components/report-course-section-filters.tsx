"use client"

import { useMemo, useState } from "react"

import { Label } from "@/components/ui/label"
import { formatSectionLabel } from "@/lib/section-label"
import { formatSessionTiming } from "@/lib/session-times"

const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm"

type CourseOption = { id: number; code: string; name: string }

type SectionOption = {
  id: number
  course_id: number
  term?: string | null
  section_number?: string | null
  label?: string | null
  courseCode: string
}

export type ReportSessionOption = {
  id: string
  started_at: string
  ended_at: string | null
  section_id: number
  course_id: number
  courseCode: string
  sectionLabel: string
}

export function ReportCourseSectionFilters({
  courses,
  sections,
  sessions,
  defaultCourse,
  defaultSection,
  defaultSession,
  onLiveChange,
}: {
  courses: CourseOption[]
  sections: SectionOption[]
  sessions?: ReportSessionOption[]
  defaultCourse?: string
  defaultSection?: string
  defaultSession?: string
  onLiveChange?: (next: {
    course: string
    section: string
    session: string
  }) => void
}) {
  const [courseId, setCourseId] = useState(defaultCourse ?? "")
  const [sectionId, setSectionId] = useState(defaultSection ?? "")
  const [sessionId, setSessionId] = useState(defaultSession ?? "")
  const sessionList = sessions ?? []
  const showSession = sessions !== undefined

  const visibleSections = useMemo(() => {
    if (!courseId) return sections
    const id = Number(courseId)
    return sections.filter((section) => section.course_id === id)
  }, [courseId, sections])

  const scopedSessions = useMemo(() => {
    if (sectionId) {
      return sessionList.filter(
        (session) => String(session.section_id) === sectionId,
      )
    }
    if (courseId) {
      return sessionList.filter(
        (session) => String(session.course_id) === courseId,
      )
    }
    return []
  }, [courseId, sectionId, sessionList])

  const sessionEnabled = Boolean(courseId || sectionId)
  const validSessionId = scopedSessions.some((session) => session.id === sessionId)
    ? sessionId
    : ""

  function allowedSessions(nextCourse: string, nextSection: string) {
    if (nextSection) {
      return sessionList.filter(
        (session) => String(session.section_id) === nextSection,
      )
    }
    if (nextCourse) {
      return sessionList.filter(
        (session) => String(session.course_id) === nextCourse,
      )
    }
    return []
  }

  function resolveSession(
    nextCourse: string,
    nextSection: string,
    currentSession = sessionId,
  ) {
    const allowed = allowedSessions(nextCourse, nextSection)
    return allowed.some((session) => session.id === currentSession)
      ? currentSession
      : ""
  }

  function sessionOptionLabel(session: ReportSessionOption) {
    const timing = formatSessionTiming(session.started_at, session.ended_at)
    const datetime = `${timing.date} ${timing.startTime}`
    if (sectionId) return datetime
    return `${session.sectionLabel} · ${datetime}`
  }

  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="course">Course</Label>
        <select
          id="course"
          name="course"
          value={courseId}
          className={selectClass}
          onChange={(event) => {
            const nextCourse = event.target.value
            setCourseId(nextCourse)
            const allowed = nextCourse
              ? sections.filter(
                  (section) => section.course_id === Number(nextCourse),
                )
              : sections
            const nextSection =
              sectionId &&
              allowed.some((section) => String(section.id) === sectionId)
                ? sectionId
                : ""
            if (nextSection !== sectionId) setSectionId(nextSection)
            const nextSession = resolveSession(nextCourse, nextSection)
            setSessionId(nextSession)
            onLiveChange?.({
              course: nextCourse,
              section: nextSection,
              session: nextSession,
            })
          }}
        >
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} {course.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="section">Section</Label>
        <select
          id="section"
          name="section"
          value={sectionId}
          className={selectClass}
          onChange={(event) => {
            const nextSection = event.target.value
            setSectionId(nextSection)
            const nextSession = resolveSession(courseId, nextSection)
            setSessionId(nextSession)
            onLiveChange?.({
              course: courseId,
              section: nextSection,
              session: nextSession,
            })
          }}
        >
          <option value="">
            {courseId ? "All sections in this course" : "All sections"}
          </option>
          {visibleSections.map((section) => (
            <option key={section.id} value={section.id}>
              {courseId
                ? formatSectionLabel(section)
                : `${section.courseCode} · ${formatSectionLabel(section)}`}
            </option>
          ))}
        </select>
      </div>
      {showSession ? (
        <div className="space-y-1">
          <Label htmlFor="session">Session</Label>
          {!sessionEnabled ? (
            <input type="hidden" name="session" value="" />
          ) : null}
          <select
            id="session"
            name={sessionEnabled ? "session" : undefined}
            value={sessionEnabled ? validSessionId : ""}
            disabled={!sessionEnabled}
            className={selectClass}
            onChange={(event) => {
              const nextSession = event.target.value
              setSessionId(nextSession)
              onLiveChange?.({
                course: courseId,
                section: sectionId,
                session: nextSession,
              })
            }}
          >
            <option value="">
              {sessionEnabled ? "All sessions" : "Select a course or section"}
            </option>
            {scopedSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {sessionOptionLabel(session)}
              </option>
            ))}
          </select>
          {!sessionEnabled ? (
            <p className="text-xs text-muted-foreground">
              Select a course or section to choose a session
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
