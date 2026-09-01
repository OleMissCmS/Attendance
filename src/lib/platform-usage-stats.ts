import type { AnalyticsPeriod } from "@/lib/analytics-period"
import type { FrictionPerDay } from "@/lib/friction-stats"

export type PlatformUsageStats = {
  generated_at: string
  period: {
    key: AnalyticsPeriod
    label: string
    start: string
    days: number
  }
  adoption: {
    accounts_by_role: Record<string, number>
    faculty_with_course: number
    faculty_with_session: number
    new_faculty_7d: number
    new_faculty_30d: number
    guest_invites: number
  }
  catalog: {
    active_courses: number
    archived_courses: number
    active_sections: number
    archived_sections: number
    roster_seats: number
    avg_roster_per_section: number | null
  }
  attendance: {
    sessions: number
    live_sessions: number
    avg_session_minutes: number | null
    checkins: number
    avg_attendance_rate: number | null
    expected_checkins: number
    present_checkins: number
    avg_daily_sessions: number | null
    avg_daily_checkins: number | null
    peak_day: {
      date: string
      sessions: number
      checkins: number
    } | null
  }
  friction: {
    roster_add_by_status: Record<string, number>
    roster_miss_attempts: number
    incognito_checkins: number
    incognito_rate: number | null
    late_device_flags: number
    device_conflict_flags: number
  }
  series: {
    sessions_per_day: { date: string; count: number }[]
    checkins_per_day: { date: string; count: number }[]
    checkins_vs_expected_per_day: {
      date: string
      actual: number
      expected: number
    }[]
    faculty_signups_per_week_12w: { week_start: string; count: number }[]
    friction_per_day: FrictionPerDay[]
  }
}

export function parsePlatformUsageStats(data: unknown): PlatformUsageStats | null {
  if (!data || typeof data !== "object") return null
  return data as PlatformUsageStats
}
