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

/** Survives client remounts when report search params change. */
let pendingReportScrollY: number | null = null

function useReportLiveNav(current: ReportLiveValues) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pendingReportScrollY == null) return
    const y = pendingReportScrollY
    pendingReportScrollY = null
    window.scrollTo(0, y)
  })

  function navigate(patch: ReportLiveValues) {
    const qs = buildReportQuery({ ...current, ...patch })
    const href = qs ? `${pathname}?${qs}` : pathname
    pendingReportScrollY = window.scrollY
    router.replace(href, { scroll: false })
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

const headerControlLabelClass =
  "whitespace-nowrap text-sm font-medium text-[#000D26]"
const headerControlInputClass =
  "h-9 rounded-md border border-[#000D26]/25 bg-white px-3 text-sm text-[#000D26]"

export function ReportAtRiskThreshold({
  current,
}: {
  current: ReportLiveValues
}) {
  const navigate = useReportLiveNav(current)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="streak" className={headerControlLabelClass}>
        Threshold
      </Label>
      <Input
        id="streak"
        name="streak"
        type="number"
        min={1}
        defaultValue={current.streak || "3"}
        placeholder="3"
        title="Consecutive missed classes threshold"
        className={`${headerControlInputClass} w-20`}
        onChange={(event) => navigate({ streak: event.target.value })}
      />
    </div>
  )
}

export function ReportFlagsFilter({
  current,
}: {
  current: ReportLiveValues
}) {
  const navigate = useReportLiveNav(current)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="flags" className={headerControlLabelClass}>
        Show
      </Label>
      <select
        id="flags"
        name="flags"
        defaultValue={current.flags || "all"}
        className={`${headerControlInputClass} w-auto min-w-[12rem]`}
        onChange={(event) => navigate({ flags: event.target.value })}
      >
        <option value="all">All</option>
        <option value="flagged">Flagged only</option>
        <option value="incognito">Private/incognito browser</option>
        <option value="late">New phone after 4th class</option>
        <option value="conflict">Phone already used by another student</option>
      </select>
    </div>
  )
}