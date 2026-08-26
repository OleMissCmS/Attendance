import { SiteChrome } from "@/components/site-chrome"
import { PlatformAnalyticsCharts } from "@/components/platform-analytics-charts"
import { requirePlatformAdmin } from "@/lib/auth"
import { formatAttendanceRate } from "@/lib/attendance-stats"
import { decryptPii } from "@/lib/pii"
import { parsePlatformUsageStats } from "@/lib/platform-usage-stats"
import { createClient } from "@/lib/supabase/server"
import { formatCentralDateTime } from "@/lib/time"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

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

type RosterMissRow = {
  id: number
  created_at: string
  source: string
  session_id: string
  section_id: number
  attempted_email_cipher: string
  course_code: string
  course_name: string
  section_label: string
  session_started_at: string
}

export default async function PlatformAnalyticsPage() {
  const profile = await requirePlatformAdmin()
  const supabase = await createClient()
  const [{ data, error }, { data: missData }] = await Promise.all([
    supabase.rpc("platform_usage_stats"),
    supabase.rpc("list_roster_miss_attempts", { p_limit: 100 }),
  ])
  const stats = parsePlatformUsageStats(data)
  const missAttempts = (Array.isArray(missData) ? missData : []) as RosterMissRow[]

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[62rem] space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#000D26]">Analytics</h1>
          <p className="mt-1 text-sm text-[#333F58]">
            Platform usage across the whole site. Aggregate counts hide student
            identities; failed check-in emails below are for support only.
          </p>
        </div>

        {error || !stats ? (
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
              <h2 className="text-lg font-extrabold text-[#000D26]">Adoption</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Faculty accounts"
                  value={formatNum(stats.adoption.accounts_by_role.faculty ?? 0)}
                  hint={`Guests ${stats.adoption.accounts_by_role.guest ?? 0} · Advisors ${stats.adoption.accounts_by_role.advisor ?? 0}`}
                />
                <KpiCard
                  label="Faculty with a course"
                  value={formatNum(stats.adoption.faculty_with_course)}
                />
                <KpiCard
                  label="Faculty who ran a session"
                  value={formatNum(stats.adoption.faculty_with_session)}
                />
                <KpiCard
                  label="New faculty"
                  value={formatNum(stats.adoption.new_faculty_30d)}
                  hint={`${stats.adoption.new_faculty_7d} in last 7 days · ${stats.adoption.guest_invites} guest invites`}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#000D26]">Catalog</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Active courses"
                  value={formatNum(stats.catalog.active_courses)}
                  hint={`${stats.catalog.archived_courses} archived`}
                />
                <KpiCard
                  label="Active sections"
                  value={formatNum(stats.catalog.active_sections)}
                  hint={`${stats.catalog.archived_sections} archived`}
                />
                <KpiCard
                  label="Roster seats"
                  value={formatNum(stats.catalog.roster_seats)}
                />
                <KpiCard
                  label="Avg roster / section"
                  value={formatNum(stats.catalog.avg_roster_per_section)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#000D26]">
                Attendance usage
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Avg attendance (all sections)"
                  value={formatRate(stats.attendance.avg_attendance_rate)}
                  hint={`${stats.attendance.present_checkins} of ${stats.attendance.expected_checkins} expected`}
                />
                <KpiCard
                  label="Sessions"
                  value={formatNum(stats.attendance.sessions_all_time)}
                  hint={`${stats.attendance.sessions_7d} / 7d · ${stats.attendance.sessions_30d} / 30d · ${stats.attendance.live_sessions} live`}
                />
                <KpiCard
                  label="Check-ins"
                  value={formatNum(stats.attendance.checkins_all_time)}
                  hint={`${stats.attendance.checkins_7d} / 7d · ${stats.attendance.checkins_30d} / 30d`}
                />
                <KpiCard
                  label="Avg session length"
                  value={
                    stats.attendance.avg_session_minutes == null
                      ? "—"
                      : `${stats.attendance.avg_session_minutes} min`
                  }
                  hint={
                    stats.attendance.peak_day_30d
                      ? `Peak day ${stats.attendance.peak_day_30d.date}: ${stats.attendance.peak_day_30d.sessions} sessions, ${stats.attendance.peak_day_30d.checkins} check-ins`
                      : undefined
                  }
                />
                <KpiCard
                  label="Avg daily sessions (30d)"
                  value={formatNum(stats.attendance.avg_daily_sessions_30d)}
                />
                <KpiCard
                  label="Avg daily check-ins (30d)"
                  value={formatNum(stats.attendance.avg_daily_checkins_30d)}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-[#000D26]">
                Friction / quality
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  label="Roster-add requests"
                  value={formatNum(
                    (stats.friction.roster_add_by_status.pending ?? 0) +
                      (stats.friction.roster_add_by_status.added ?? 0) +
                      (stats.friction.roster_add_by_status.rejected ?? 0),
                  )}
                  hint={`Pending ${stats.friction.roster_add_by_status.pending ?? 0} · Added ${stats.friction.roster_add_by_status.added ?? 0} · Rejected ${stats.friction.roster_add_by_status.rejected ?? 0}`}
                />
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-[#333F58]">
                      <a href="#failed-checkins" className="hover:underline">
                        Not-on-roster attempts
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-extrabold text-[#000D26]">
                      {formatNum(stats.friction.roster_miss_attempts)}
                    </p>
                    {missAttempts.length ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <a href="#failed-checkins" className="hover:underline">
                          See failed check-ins below
                        </a>
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
                <KpiCard
                  label="Incognito check-ins"
                  value={formatNum(stats.friction.incognito_checkins)}
                  hint={
                    stats.friction.incognito_rate == null
                      ? undefined
                      : `${formatRate(stats.friction.incognito_rate)} of all check-ins`
                  }
                />
                <KpiCard
                  label="Device flags"
                  value={formatNum(
                    stats.friction.late_device_flags +
                      stats.friction.device_conflict_flags,
                  )}
                  hint={`Late device ${stats.friction.late_device_flags} · Conflict ${stats.friction.device_conflict_flags}`}
                />
              </div>
            </section>

            <PlatformAnalyticsCharts stats={stats} />

            <section id="failed-checkins" className="space-y-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#000D26]">
                  Failed check-in emails
                </h2>
                <p className="mt-1 text-sm text-[#333F58]">
                  Recent not-on-roster attempts (class, section, session, and
                  the email they entered).
                </p>
              </div>
              {missAttempts.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No failed check-in emails logged yet.
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="overflow-x-auto p-0">
                    <table className="w-full min-w-[40rem] text-left text-sm">
                      <thead className="border-b bg-[#F7F8FA] text-xs uppercase tracking-wide text-[#333F58]">
                        <tr>
                          <th className="px-4 py-3 font-semibold">When</th>
                          <th className="px-4 py-3 font-semibold">Class</th>
                          <th className="px-4 py-3 font-semibold">Section</th>
                          <th className="px-4 py-3 font-semibold">Session</th>
                          <th className="px-4 py-3 font-semibold">Email entered</th>
                          <th className="px-4 py-3 font-semibold">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {missAttempts.map((row) => {
                          const email =
                            decryptPii(row.attempted_email_cipher) ||
                            "(unknown)"
                          const sourceLabel =
                            row.source === "roster_add_enrolled"
                              ? "Already on roster (add form)"
                              : "Not on roster"
                          return (
                            <tr key={row.id} className="align-top">
                              <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                                {formatCentralDateTime(row.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-medium text-[#000D26]">
                                  {row.course_code}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {row.course_name}
                                </span>
                              </td>
                              <td className="px-4 py-3">{row.section_label}</td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/faculty/sections/${row.section_id}`}
                                  className="underline-offset-4 hover:underline"
                                >
                                  {formatCentralDateTime(row.session_started_at)}
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-medium text-[#000D26]">
                                {email}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {sourceLabel}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}
      </main>
    </SiteChrome>
  )
}
