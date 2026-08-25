import { SiteChrome } from "@/components/site-chrome"
import { PlatformAnalyticsCharts } from "@/components/platform-analytics-charts"
import { requirePlatformAdmin } from "@/lib/auth"
import { formatAttendanceRate } from "@/lib/attendance-stats"
import { parsePlatformUsageStats } from "@/lib/platform-usage-stats"
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

export default async function PlatformAnalyticsPage() {
  const profile = await requirePlatformAdmin()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("platform_usage_stats")
  const stats = parsePlatformUsageStats(data)

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[62rem] space-y-8 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold text-[#000D26]">Analytics</h1>
          <p className="mt-1 text-sm text-[#333F58]">
            Platform usage only — counts and rates across the whole site. No
            student identities, and no other instructors&apos; detailed
            attendance or rosters.
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
                <KpiCard
                  label="Not-on-roster attempts"
                  value={formatNum(stats.friction.roster_miss_attempts)}
                />
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
          </>
        )}
      </main>
    </SiteChrome>
  )
}
