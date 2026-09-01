export type FrictionPerDay = {
  date: string
  roster_add_requests: number
  roster_miss_attempts: number
  incognito_checkins: number
  device_flags: number
}

export const FRICTION_LINE_LABELS = {
  roster_add_requests: "Roster-add requests",
  roster_miss_attempts: "Not-on-roster attempts",
  incognito_checkins: "Incognito check-ins",
  device_flags: "Device flags",
} as const
