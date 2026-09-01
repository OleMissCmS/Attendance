import { SiteChrome } from "@/components/site-chrome"
import { AnalyticsPeriodSelector } from "@/components/analytics-period-selector"
import { AnalyticsScopeSelector } from "@/components/analytics-scope-selector"
import { CheckinsExpectedChart } from "@/components/checkins-expected-chart"
import { FrictionQualityChart } from "@/components/friction-quality-chart"
import { requireFaculty } from "@/lib/auth"
import { parseAnalyticsPeriod } from "@/lib/analytics-period"
import {
  parseIdList,
  type AnalyticsScopeOption,
} from "@/lib/analytics-scope"
import { formatAttendanceRate } from "@/lib/attendance-stats"
import { loadMyAnalyticsScope } from "@/lib/analytics-catalog"
import { isAdvisorRole } from "@/lib/faculty-email"
import { formatSectionLabel } from "@/lib/section-label"
import { parseScopedUsageStats } from "@/lib/scoped-usage-stats"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-[#333F58]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-extrabold text-[#000D26]">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}

function formatNum(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—"
  return String(value)
}

function formatRate(value: number | null | undefined) {
  if (value == null) return "—"
  return formatAttendanceRate(value)
}

function scopeSummary(
  courseIds: number[],
  sectionIds: number[],
  sections: AnalyticsScopeOption[],
) {
  if (sectionIds.length) {
    return `${sectionIds.length} section${sectionIds.length === 1 ? "" : "s"} selected`
  }
  if (courseIds.length) {
    return `${courseIds.length} course${courseIds.length === 1 ? "" : "s"} selected`
  }
  return `All ${sections.length} authorized section${sections.length === 1 ? "" : "s"}`
}

export default async function FacultyStatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string
    courses?: string
    sections?: string
  }>
}) {
  const profile = await requireFaculty()
  const advisor = isAdvisorRole(profile.role)
  const filters = await searchParams
  const period = parseAnalyticsPeriod(filters.period)
  const courseIds = parseIdList(filters.courses)
  const sectionIds = parseIdList(filters.sections)
  const authorized = await loadMyAnalyticsScope(profile)
  const scopeSections: AnalyticsScopeOption[] = authorized.flatMap((course) =>
    course.sections.map((section) => ({
      id: section.id,
      course_id: course.id,
      courseCode: course.code,
      courseName: course.name,
      term: section.term,
      section_number: section.section_number,
      label: section.label,
    })),
  )
  const authorizedSectionIds = scopeSections.map((section) => section.id)

  const supabase = await createClient()
  const rpcSectionIds =
    sectionIds.length > 0
      ? sectionIds
      : courseIds.length > 0
        ? null
        : advisor
          ? null
          : authorizedSectionIds.length > 0
            ? authorizedSectionIds
            : null

  const { data, error } = await supabase.rpc("faculty_usage_stats", {
    p_period: period,
    p_course_ids: courseIds.length ? courseIds : null,
    p_section_ids: rpcSectionIds,
  })
  const stats = parseScopedUsageStats(data)
  const emptyScope = scopeSections.length === 0

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[62rem] space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#000D26]">My Analytics</h1>
          <p className="mt-1 text-sm text-[#333F58]">
            {advisor
              ? "Attendance usage across all active courses and sections. Aggregate counts only — student identities are not shown."
              : "Attendance usage for courses and sections you own or are invited to. Aggregate counts only — student identities are not shown."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Courses & sections</CardTitle>
          </CardHeader>
          <CardContent>
            <AnalyticsScopeSelector
              courses={authorized.map((course) => ({
                id: course.id,
                code: course.code,
                name: course.name,
              }))}
              sections={scopeSections.map((section) => ({
                ...section,
                label: formatSectionLabel(section),
              }))}
              defaultCourseIds={courseIds}
              defaultSectionIds={sectionIds}
              period={period}
            />
          </CardContent>
        </Card>

        {emptyScope ? (
          <section className="rounded-xl border border-[#333F58]/15 bg-white px-6 py-16 text-center">
            <h2 className="text-lg font-extrabold text-[#000D26]">
              No courses in scope
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#333F58]">
              {advisor
                ? "No active courses or sections are in the catalog yet."
                : "Create a course or accept a guest invite to see usage analytics here."}
            </p>
          </section>
        ) : error || !stats ? (
          <section className="rounded-xl border border-[#333F58]/15 bg-white px-6 py-12 text-center">
            <h2 className="text-lg font-extrabold text-[#000D26]">
              Could not load analytics
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#333F58]">
              {error?.message || "Try again in a moment."}
            </p>
          </section>
        ) : (
          <>
            <section className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-extrabold text-[#000D26]">
                    Attendance usage
                  </h2>
                  <p className="mt-1 text-sm text-[#333F58]">
                    {scopeSummary(courseIds, sectionIds, scopeSections)} ·{" "}
                    {stats.period.label.toLowerCase()}.
                  </p>
                </div>
                <AnalyticsPeriodSelector
                  period={period}
                  courses={filters.courses}
                  sections={filters.sections}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Avg attendance"
                  value={formatRate(stats.attendance.avg_attendance_rate)}
                  hint={`${stats.attendance.present_checkins} of ${stats.attendance.expected_checkins} expected`}
                />
                <KpiCard
                  label="Sessions"
                  value={formatNum(stats.attendance.sessions)}
                  hint={`${stats.attendance.live_sessions} live`}
                />
                <KpiCard
                  label="Check-ins"
                  value={formatNum(stats.attendance.checkins)}
                />
                <KpiCard
                  label="Avg session length"
                  value={
                    stats.attendance.avg_session_minutes == null
                      ? "—"
                      : `${stats.attendance.avg_session_minutes} min`
                  }
                  hint={
                    stats.attendance.peak_day
                      ? `Peak day ${stats.attendance.peak_day.date}: ${stats.attendance.peak_day.sessions} sessions, ${stats.attendance.peak_day.checkins} check-ins`
                      : undefined
                  }
                />
                <KpiCard
                  label="Avg daily sessions"
                  value={formatNum(stats.attendance.avg_daily_sessions)}
                />
                <KpiCard
                  label="Avg daily check-ins"
                  value={formatNum(stats.attendance.avg_daily_checkins)}
                />
              </div>
              <CheckinsExpectedChart
                periodLabel={stats.period.label}
                data={stats.series.checkins_vs_expected_per_day ?? []}
              />
            </section>

            <FrictionQualityChart
              period={period}
              periodLabel={stats.period.label}
              data={stats.series.friction_per_day ?? []}
              courses={filters.courses}
              sections={filters.sections}
            />
          </>
        )}
      </main>
    </SiteChrome>
  )
}
