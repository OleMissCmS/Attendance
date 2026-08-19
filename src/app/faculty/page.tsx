import { SiteChrome } from "@/components/site-chrome"
import { StartCheckInForm } from "@/components/start-check-in-form"
import { isActiveRecord } from "@/lib/active"
import { requireFaculty } from "@/lib/auth"
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
        course.faculty_id === profile.id || course.sections.length > 0,
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

        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold">Your courses</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a section roster. Create courses, add sections, and invite
              guests under Manage Courses.
            </p>
          </div>

          {!visibleCourses.length ? (
            <p className="text-muted-foreground">
              Create a course under Manage Courses to start taking attendance.
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
                          Guest
                        </span>
                      ) : null}
                    </header>
                    <div className="space-y-3 bg-[#F4F6F8] p-4">
                      {course.sections?.length ? (
                        course.sections.map((section) => (
                          <Link
                            key={section.id}
                            href={`/faculty/sections/${section.id}`}
                            aria-label={`Open ${course.code}, ${formatSectionLabel(section)} roster`}
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
