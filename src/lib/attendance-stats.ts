import { centralDateInput, formatCentralMonthDay } from "@/lib/time"

export function maxConsecutiveAbsences(
  sessionsOldestFirst: { id: string }[],
  presentSessionIds: Set<string>,
) {
  let max = 0
  let current = 0
  for (const session of sessionsOldestFirst) {
    if (presentSessionIds.has(session.id)) {
      current = 0
    } else {
      current += 1
      if (current > max) max = current
    }
  }
  return max
}

export function currentAbsenceStreak(
  sessionsNewestFirst: { id: string }[],
  presentSessionIds: Set<string>,
) {
  let streak = 0
  for (const session of sessionsNewestFirst) {
    if (presentSessionIds.has(session.id)) break
    streak += 1
  }
  return streak
}

export type FacultySectionStat = {
  sectionId: number
  courseCode: string
  courseName: string
  sectionLabel: string
  enrollmentCount: number
  sessionCount: number
  expected: number
  present: number
  rate: number
  noShowCount: number
  atRiskCount: number
}

export type FacultyStats = {
  overallRate: number
  sessionCount: number
  enrollmentCount: number
  expectedCount: number
  presentCount: number
  noShowCount: number
  atRiskCount: number
  sections: FacultySectionStat[]
  byCourse: { label: string; rate: number; sessionCount: number }[]
  overTime: { date: string; label: string; rate: number }[]
}

function sessionDayKey(startedAt: string) {
  return centralDateInput(startedAt)
}

export function buildFacultyStats(input: {
  sections: {
    id: number
    courseCode: string
    courseName: string
    sectionLabel: string
  }[]
  enrollments: { section_id: number; email_hash: string }[]
  sessions: { id: string; section_id: number; started_at: string }[]
  records: { session_id: string; email_hash: string }[]
  atRiskThreshold?: number
}): FacultyStats {
  const threshold = Math.max(1, input.atRiskThreshold ?? 3)
  const presentKeys = new Set(
    input.records.map((record) => `${record.session_id}:${record.email_hash}`),
  )
  const enrollmentsBySection = new Map<number, { email_hash: string }[]>()
  for (const enrollment of input.enrollments) {
    const list = enrollmentsBySection.get(enrollment.section_id) ?? []
    list.push(enrollment)
    enrollmentsBySection.set(enrollment.section_id, list)
  }
  const sessionsBySection = new Map<number, typeof input.sessions>()
  for (const session of input.sessions) {
    const list = sessionsBySection.get(session.section_id) ?? []
    list.push(session)
    sessionsBySection.set(session.section_id, list)
  }

  const sections: FacultySectionStat[] = input.sections.map((section) => {
    const enrollments = enrollmentsBySection.get(section.id) ?? []
    const sessions = [...(sessionsBySection.get(section.id) ?? [])].sort(
      (a, b) => a.started_at.localeCompare(b.started_at),
    )
    let present = 0
    let noShowCount = 0
    let atRiskCount = 0
    for (const enrollment of enrollments) {
      const presentIds = new Set(
        sessions
          .filter((session) =>
            presentKeys.has(`${session.id}:${enrollment.email_hash}`),
          )
          .map((session) => session.id),
      )
      present += presentIds.size
      if (sessions.length && presentIds.size === 0) noShowCount += 1
      if (
        sessions.length &&
        maxConsecutiveAbsences(sessions, presentIds) >= threshold
      ) {
        atRiskCount += 1
      }
    }
    const expected = enrollments.length * sessions.length
    return {
      sectionId: section.id,
      courseCode: section.courseCode,
      courseName: section.courseName,
      sectionLabel: section.sectionLabel,
      enrollmentCount: enrollments.length,
      sessionCount: sessions.length,
      expected,
      present,
      rate: expected ? present / expected : 0,
      noShowCount,
      atRiskCount,
    }
  })

  const expectedCount = sections.reduce((sum, row) => sum + row.expected, 0)
  const presentCount = sections.reduce((sum, row) => sum + row.present, 0)

  const courseMap = new Map<
    string,
    { present: number; expected: number; sessionCount: number }
  >()
  for (const row of sections) {
    const label = `${row.courseCode} ${row.courseName}`.trim()
    const existing = courseMap.get(label) ?? {
      present: 0,
      expected: 0,
      sessionCount: 0,
    }
    existing.present += row.present
    existing.expected += row.expected
    existing.sessionCount += row.sessionCount
    courseMap.set(label, existing)
  }

  const dayMap = new Map<string, { present: number; expected: number }>()
  for (const session of input.sessions) {
    const enrollments = enrollmentsBySection.get(session.section_id) ?? []
    const expected = enrollments.length
    let present = 0
    for (const enrollment of enrollments) {
      if (presentKeys.has(`${session.id}:${enrollment.email_hash}`)) present += 1
    }
    const key = sessionDayKey(session.started_at)
    const existing = dayMap.get(key) ?? { present: 0, expected: 0 }
    existing.present += present
    existing.expected += expected
    dayMap.set(key, existing)
  }

  const overTime = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      label: formatCentralMonthDay(`${date}T12:00:00`),
      rate: values.expected ? values.present / values.expected : 0,
    }))

  return {
    overallRate: expectedCount ? presentCount / expectedCount : 0,
    sessionCount: input.sessions.length,
    enrollmentCount: input.enrollments.length,
    expectedCount,
    presentCount,
    noShowCount: sections.reduce((sum, row) => sum + row.noShowCount, 0),
    atRiskCount: sections.reduce((sum, row) => sum + row.atRiskCount, 0),
    sections,
    byCourse: [...courseMap.entries()].map(([label, values]) => ({
      label,
      rate: values.expected ? values.present / values.expected : 0,
      sessionCount: values.sessionCount,
    })),
    overTime,
  }
}

export function formatAttendanceRate(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`
}
