import { SiteChrome } from "@/components/site-chrome"
import { FacultyStatsCharts } from "@/components/faculty-stats-charts"
import { ReportCourseSectionFilters } from "@/components/report-course-section-filters"
import { requireFaculty } from "@/lib/auth"
import {
  buildFacultyStats,
  formatAttendanceRate,
} from "@/lib/attendance-stats"
import { loadAuthorizedCourses } from "@/lib/faculty-access"
import { formatSectionLabel } from "@/lib/section-label"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default async function FacultyStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; section?: string; from?: string; to?: string }>
}) {
  const profile = await requireFaculty()
  const filters = await searchParams
  const supabase = await createClient()
  const authorized = await loadAuthorizedCourses(profile.id)
  const courseId = filters.course ? Number(filters.course) : undefined
  const sectionId = filters.section ? Number(filters.section) : undefined
  const allSections = authorized.flatMap((course) =>
    course.sections.map((section) => ({
      id: section.id,
      course_id: course.id,
      courseCode: course.code,
      courseName: course.name,
      sectionLabel: formatSectionLabel(section),
      term: section.term,
      section_number: section.section_number,
      label: section.label,
    })),
  )
  const sections = allSections.filter((section) => {
    if (courseId && section.course_id !== courseId) return false
    if (sectionId) return section.id === sectionId
    return true
  })
  const sectionIds = sections.map((section) => section.id)

  const { data: enrollments } = sectionIds.length
    ? await supabase
        .from("enrollments")
        .select("section_id, email_hash")
        .in("section_id", sectionIds)
    : { data: [] }

  let sessionQuery = supabase
    .from("attendance_sessions")
    .select("id, section_id, started_at")
    .order("started_at", { ascending: true })
  if (sectionIds.length) sessionQuery = sessionQuery.in("section_id", sectionIds)
  if (filters.from) {
    sessionQuery = sessionQuery.gte("started_at", `${filters.from}T00:00:00`)
  }
  if (filters.to) {
    sessionQuery = sessionQuery.lte("started_at", `${filters.to}T23:59:59`)
  }
  const { data: sessions } = sectionIds.length
    ? await sessionQuery
    : { data: [] }

  const sessionIds = sessions?.map((session) => session.id) ?? []
  const { data: records } = sessionIds.length
    ? await supabase
        .from("attendance_records")
        .select("session_id, email_hash")
        .in("session_id", sessionIds)
    : { data: [] }

  const stats = buildFacultyStats({
    sections,
    enrollments: enrollments ?? [],
    sessions: sessions ?? [],
    records: records ?? [],
  })
  const lowestSections = [...stats.sections]
    .filter((row) => row.sessionCount > 0)
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 8)
  const empty = stats.sessionCount === 0

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[62rem] space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#000D26]">Stats</h1>
          <p className="mt-1 text-sm text-[#333F58]">
            Attendance rates for courses and sections you own or are invited
            to. Soft-deleted courses are excluded. Names are not listed.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Optional filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ReportCourseSectionFilters
                courses={authorized.map((course) => ({
                  id: course.id,
                  code: course.code,
                  name: course.name,
                }))}
                sections={allSections.map((section) => ({
                  id: section.id,
                  course_id: section.course_id,
                  term: section.term,
                  section_number: section.section_number,
                  label: section.label,
                  courseCode: section.courseCode,
                }))}
                defaultCourse={filters.course ?? ""}
                defaultSection={filters.section ?? ""}
              />
              <div className="space-y-1">
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={filters.from ?? ""}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={filters.to ?? ""}
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <Button type="submit">Apply filters</Button>
                <a
                  href="/faculty/stats"
                  className="inline-flex h-9 items-center text-sm font-bold underline-offset-4 hover:underline"
                >
                  Clear filters
                </a>
              </div>
            </form>
          </CardContent>
        </Card>

        {empty ? (
          <section className="rounded-xl border border-[#333F58]/15 bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-extrabold text-[#000D26]">
              No sessions yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#333F58]">
              Start a check-in session from Courses. Charts and rates appear
              here after the first session.
            </p>
          </section>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Overall attendance"
                value={formatAttendanceRate(stats.overallRate)}
                hint={`${stats.presentCount} of ${stats.expectedCount} expected check-ins`}
              />
              <KpiCard
                label="Sessions"
                value={String(stats.sessionCount)}
                hint={`${stats.enrollmentCount} rostered students`}
              />
              <KpiCard
                label="No shows"
                value={String(stats.noShowCount)}
                hint="Students with zero check-ins in a section"
                alert={stats.noShowCount > 0}
              />
              <KpiCard
                label="At risk"
                value={String(stats.atRiskCount)}
                hint="3+ consecutive missed classes"
                alert={stats.atRiskCount > 0}
              />
            </div>

            <FacultyStatsCharts stats={stats} />

            <section className="rounded-xl border border-[#333F58]/15 bg-white p-6">
              <h2 className="text-lg font-extrabold text-[#000D26]">
                Lowest-attendance sections
              </h2>
              <p className="mt-1 text-sm text-[#333F58]">
                Sections with at least one session, ranked by attendance rate.
              </p>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Roster</TableHead>
                      <TableHead>No shows</TableHead>
                      <TableHead>At risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowestSections.length ? (
                      lowestSections.map((row) => (
                        <TableRow key={row.sectionId}>
                          <TableCell>
                            {row.courseCode} {row.courseName}
                          </TableCell>
                          <TableCell>{row.sectionLabel}</TableCell>
                          <TableCell className="font-bold">
                            {formatAttendanceRate(row.rate)}
                          </TableCell>
                          <TableCell>{row.sessionCount}</TableCell>
                          <TableCell>{row.enrollmentCount}</TableCell>
                          <TableCell
                            className={
                              row.noShowCount
                                ? "font-semibold text-[#CF142B]"
                                : undefined
                            }
                          >
                            {row.noShowCount}
                          </TableCell>
                          <TableCell
                            className={
                              row.atRiskCount
                                ? "font-semibold text-[#CF142B]"
                                : undefined
                            }
                          >
                            {row.atRiskCount}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7}>
                          No sections with sessions yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </main>
    </SiteChrome>
  )
}

function KpiCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string
  hint: string
  alert?: boolean
}) {
  return (
    <section className="rounded-xl border border-[#333F58]/15 bg-white p-5">
      <p className="text-xs font-bold tracking-wide text-[#333F58] uppercase">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-extrabold ${
          alert ? "text-[#CF142B]" : "text-[#000D26]"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-[#333F58]">{hint}</p>
    </section>
  )
}
