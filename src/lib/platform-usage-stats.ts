export type PlatformUsageStats = {
  generated_at: string
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
    sessions_all_time: number
    sessions_7d: number
    sessions_30d: number
    live_sessions: number
    avg_session_minutes: number | null
    checkins_all_time: number
    checkins_7d: number
    checkins_30d: number
    avg_attendance_rate: number | null
    expected_checkins: number
    present_checkins: number
    avg_daily_sessions_30d: number | null
    avg_daily_checkins_30d: number | null
    peak_day_30d: {
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
    sessions_per_day_30d: { date: string; count: number }[]
    checkins_per_day_30d: { date: string; count: number }[]
    faculty_signups_per_week_12w: { week_start: string; count: number }[]
  }
}

export function parsePlatformUsageStats(data: unknown): PlatformUsageStats | null {
  if (!data || typeof data !== "object") return null
  return data as PlatformUsageStats
}
