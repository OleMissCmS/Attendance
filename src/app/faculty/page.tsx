import { SiteChrome } from "@/components/site-chrome"
import { StartCheckInForm } from "@/components/start-check-in-form"
import { isActiveRecord } from "@/lib/active"
import { requireFaculty } from "@/lib/auth"
import {
  canManageAttendanceData,
  isAdvisorRole,
} from "@/lib/faculty-email"
import { formatSectionLabel } from "@/lib/section-label"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function FacultyHomePage({
  searchParams,
}: {
  searchParams: Promise<{ started?: string; reused?: string; error?: string }>
}) {
  const profile = await requireFaculty()
  const canManage = canManageAttendanceData(profile.role)
  const advisor = isAdvisorRole(profile.role)
  const { started, reused, error } = await searchParams
  const supabase = await createClient()
  const { data: courses } = await supabase
    .from("courses")
    .select("*, sections(*)")
    .is("deleted_at", null)
    .order("code")

  const visibleCourses = (courses ?? [])
    .filter(isActiveRecord)
    .map((course) => ({
      ...course,
      sections: (course.sections ?? []).filter(isActiveRecord),
    }))
    .filter(
      (course) =>
        advisor ||
        course.faculty_id === profile.id ||
        course.sections.length > 0,
    )
  const sectionIds = visibleCourses.flatMap((course) =>
    (course.sections ?? []).map((section) => section.id),
  )
  const { data: liveSessions } = sectionIds.length
    ? await supabase
        .from("attendance_sessions")
        .select("id, section_id")
        .in("section_id", sectionIds)
        .is("ended_at", null)
    : { data: [] as { id: string; section_id: number }[] }
  const liveBySection = new Map(
    (liveSessions ?? []).map((session) => [session.section_id, session.id]),
  )
  const { data: pendingRequests } = sectionIds.length
    ? await supabase
        .from("roster_add_requests")
        .select("section_id")
        .in("section_id", sectionIds)
        .eq("status", "pending")
    : { data: [] as { section_id: number }[] }
  const sectionsWithRequests = new Set(
    (pendingRequests ?? []).map((row) => row.section_id),
  )
  const startCourses = visibleCourses
    .filter((course) => (course.sections ?? []).length > 0)
    .map((course) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      sections: (course.sections ?? []).map((section) => ({
        id: section.id,
        term: section.term,
        section_number: section.section_number,
        label: section.label,
        liveSessionId: liveBySection.get(section.id) ?? null,
      })),
    }))

  const startedIds = (started ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  const reusedIds = (reused ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
  const noticeIds = [...new Set([...startedIds, ...reusedIds])]
  const { data: startedRows } = noticeIds.length
    ? await supabase
        .from("attendance_sessions")
        .select(
          "id, sections(term, section_number, label, courses(code, name))",
        )
        .in("id", noticeIds)
    : { data: [] as { id: string; sections: unknown }[] }
  const startedSessions = (startedRows ?? []).map((row) => {
    const section = row.sections
    const sectionRow = Array.isArray(section) ? section[0] : section
    const course = sectionRow && typeof sectionRow === "object" && "courses" in sectionRow
      ? sectionRow.courses
      : null
    const courseRow = Array.isArray(course) ? course[0] : course
    const code =
      courseRow && typeof courseRow === "object" && "code" in courseRow
        ? String(courseRow.code)
        : ""
    const sectionLabel =
      sectionRow && typeof sectionRow === "object"
        ? formatSectionLabel(
            sectionRow as {
              term?: string
              section_number?: string
              label?: string
            },
          )
        : "Section"
    return {
      id: row.id,
      label: [code, sectionLabel].filter(Boolean).join(" · "),
      reused: reusedIds.includes(row.id),
    }
  })

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[50rem] space-y-10 px-4 py-8">
        {canManage ? (
        <section>
          <Card className="overflow-hidden border-[#333F58]/20 pt-0">
            <CardHeader className="bg-[#A1C6E7] px-4 py-1.5">
              <CardTitle className="text-xl text-[#000D26]">
                Start Check-In Session
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <StartCheckInForm
                courses={startCourses}
                startedSessions={startedSessions}
                error={error === "session" ? error : undefined}
              />
            </CardContent>
          </Card>
        </section>
        ) : null}

        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold">
              {advisor ? "All courses" : "Your courses"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {advisor
                ? "View-only access. Open a section to review rosters and session history, or use Reports and Stats."
                : "Open a section roster. Create courses, add sections, and invite guests under Manage Courses."}
            </p>
          </div>

          {!visibleCourses.length ? (
            <p className="text-muted-foreground">
              {advisor
                ? "No courses are available yet."
                : "Create a course under Manage Courses to start taking attendance."}
            </p>
          ) : (
            <div className="space-y-8">
              {visibleCourses.map((course) => {
                const owner = course.faculty_id === profile.id
                return (
                  <article
                    key={course.id}
                    className="overflow-hidden rounded-xl border border-[#d5dbe3] bg-white shadow-sm"
                  >
                    <header className="flex flex-wrap items-center justify-between gap-2 bg-[#A1C6E7] px-4 py-1.5 text-[#000D26]">
                      <div>
                        <p className="text-lg font-extrabold tracking-tight">
                          {course.code}
                        </p>
                        <p className="text-sm font-medium text-[#000D26]/90">
                          {course.name}
                        </p>
                      </div>
                      {!owner ? (
                        <span className="rounded-md bg-[#000D26] px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
                          {advisor ? "View only" : "Guest"}
                        </span>
                      ) : null}
                    </header>
                    <div className="space-y-3 bg-[#F4F6F8] p-4">
                      {course.sections?.length ? (
                        course.sections.map((section) => (
                          <Link
                            key={section.id}
                            href={`/faculty/sections/${section.id}`}
                            aria-label={
                              sectionsWithRequests.has(section.id)
                                ? `Open ${course.code}, ${formatSectionLabel(section)} roster. Roster add requests pending.`
                                : `Open ${course.code}, ${formatSectionLabel(section)} roster`
                            }
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#d5dbe3] border-l-4 border-l-[#333F58] bg-white px-4 py-3.5 transition-colors hover:border-[#333F58] hover:bg-white"
                          >
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#333F58]">
                                Term
                              </p>
                              <p className="text-base font-extrabold text-[#000D26]">
                                {section.term?.trim() || "—"}
                              </p>
                            </div>
                            {sectionsWithRequests.has(section.id) ? (
                              <span
                                className="inline-flex size-8 items-center justify-center text-[#CE1126]"
                                title="Roster add requests"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="size-6"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  aria-hidden
                                >
                                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                                  <path d="M12 9v4" />
                                  <path d="M12 17h.01" />
                                </svg>
                              </span>
                            ) : null}
                            <div className="sm:text-right">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-[#333F58]">
                                Section Number
                              </p>
                              <p className="text-base font-extrabold text-[#000D26]">
                                {section.section_number?.trim() ||
                                  formatSectionLabel(section)}
                              </p>
                            </div>
                          </Link>
                        ))
                      ) : (
                        <p className="rounded-lg border border-dashed border-[#d5dbe3] bg-white px-4 py-3 text-sm text-muted-foreground">
                          No sections yet. Add one under Manage Courses.
                        </p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </SiteChrome>
  )
}
