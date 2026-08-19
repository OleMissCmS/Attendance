"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

import {
  ReportCourseSectionFilters,
  type ReportSessionOption,
} from "@/components/report-course-section-filters"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  buildReportQuery,
  type ReportFilterKey,
} from "@/lib/report-filters"

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

export type ReportLiveValues = Partial<
  Record<ReportFilterKey, string | null | undefined>
>

function useReportLiveNav(current: ReportLiveValues) {
  const router = useRouter()
  const pathname = usePathname()

  function navigate(patch: ReportLiveValues) {
    const qs = buildReportQuery({ ...current, ...patch })
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  return navigate
}

export function ReportLiveFilters({
  courses,
  sections,
  sessions,
  current,
}: {
  courses: CourseOption[]
  sections: SectionOption[]
  sessions: ReportSessionOption[]
  current: ReportLiveValues
}) {
  const navigate = useReportLiveNav(current)
  const [student, setStudent] = useState(current.student ?? "")
  const studentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setStudent(current.student ?? "")
  }, [current.student])

  useEffect(() => {
    return () => {
      if (studentTimer.current) clearTimeout(studentTimer.current)
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReportCourseSectionFilters
          courses={courses}
          sections={sections}
          sessions={sessions}
          defaultCourse={current.course ?? ""}
          defaultSection={current.section ?? ""}
          defaultSession={current.session ?? ""}
          onLiveChange={(next) => navigate(next)}
        />
        <div className="space-y-1">
          <Label htmlFor="student">Student (email or username)</Label>
          <Input
            id="student"
            name="student"
            value={student}
            placeholder="(e.g. you@go.olemiss.edu)"
            onChange={(event) => {
              const value = event.target.value
              setStudent(value)
              if (studentTimer.current) clearTimeout(studentTimer.current)
              studentTimer.current = setTimeout(() => {
                navigate({ student: value })
              }, 400)
            }}
            onBlur={() => {
              if (studentTimer.current) clearTimeout(studentTimer.current)
              if ((current.student ?? "") !== student) {
                navigate({ student })
              }
            }}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={current.from ?? ""}
            onChange={(event) => navigate({ from: event.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={current.to ?? ""}
            onChange={(event) => navigate({ to: event.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

export function ReportLiveAltControls({
  current,
}: {
  current: ReportLiveValues
}) {
  const navigate = useReportLiveNav(current)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="streak">
          At Risk: consecutive missed classes threshold
        </Label>
        <Input
          id="streak"
          name="streak"
          type="number"
          min={1}
          defaultValue={current.streak || "3"}
          placeholder="(e.g. 3)"
          className="max-w-32"
          onChange={(event) => navigate({ streak: event.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="flags">Flags</Label>
        <select
          id="flags"
          name="flags"
          defaultValue={current.flags || "all"}
          className={selectClass}
          onChange={(event) => navigate({ flags: event.target.value })}
        >
          <option value="all">All</option>
          <option value="flagged">Flagged only</option>
          <option value="incognito">Incognito</option>
          <option value="late">New phone after 4th class</option>
        </select>
      </div>
    </div>
  )
}