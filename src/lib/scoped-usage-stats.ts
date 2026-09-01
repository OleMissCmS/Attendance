import type { AnalyticsPeriod } from "@/lib/analytics-period"
import type { FrictionPerDay } from "@/lib/friction-stats"

export type CheckinsVsExpectedDay = {
  date: string
  actual: number
  expected: number
}

export type ScopedUsageStats = {
  generated_at: string
  period: {
    key: AnalyticsPeriod
    label: string
    start: string
    days: number
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
  series: {
    sessions_per_day: { date: string; count: number }[]
    checkins_per_day: { date: string; count: number }[]
    checkins_vs_expected_per_day: CheckinsVsExpectedDay[]
    friction_per_day: FrictionPerDay[]
  }
}

export function parseScopedUsageStats(data: unknown): ScopedUsageStats | null {
  if (!data || typeof data !== "object") return null
  return data as ScopedUsageStats
}
