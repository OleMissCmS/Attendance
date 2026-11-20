import { decryptEnrollment, type StudentIdentity } from "@/lib/pii"
import { APP_TIME_ZONE, centralDateInput } from "@/lib/time"

export function attendanceGradeHeader(startedAt: string, used: Set<string>) {
  const date = new Date(startedAt)
  const ymd = centralDateInput(date)
  let label = `Attendance ${ymd} [Total Pts: 1 Score]`
  if (used.has(label)) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)
    const hour = parts.find((part) => part.type === "hour")?.value ?? "00"
    const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
    label = `Attendance ${ymd} ${hour}${minute} [Total Pts: 1 Score]`
  }
  used.add(label)
  return label
}

export function buildBlackboardGradeCenter(options: {
  enrollments: {
    email_hash: string
    email_cipher: string
    name_cipher: string | null
    last_name_cipher: string | null
    first_name_cipher: string | null
    username_cipher: string | null
    student_id_cipher: string | null
  }[]
  sessions: { id: string; started_at: string }[]
  presentKeys: Set<string>
  studentHashes?: string[]
}): { headers: string[]; rows: string[][]; emailHashes: string[]; sessionIds: string[] } {
  const sessions = [...options.sessions].sort((a, b) =>
    a.started_at.localeCompare(b.started_at),
  )
  const used = new Set<string>()
  const gradeHeaders = sessions.map((session) =>
    attendanceGradeHeader(session.started_at, used),
  )
  const headers = [
    "Last Name",
    "First Name",
    "Username",
    "Student ID",
    ...gradeHeaders,
  ]

  const lookup = options.studentHashes ?? []
  const people = options.enrollments
    .filter((row) =>
      lookup.length ? lookup.includes(row.email_hash) : true,
    )
    .map((row) => {
      const student: StudentIdentity = decryptEnrollment(row)
      return { row, student }
    })
    .sort(
      (a, b) =>
        a.student.lastName.localeCompare(b.student.lastName) ||
        a.student.firstName.localeCompare(b.student.firstName),
    )

  const rows = people.map(({ row, student }) => [
    student.lastName,
    student.firstName,
    student.username,
    student.studentId,
    ...sessions.map((session) =>
      options.presentKeys.has(`${session.id}:${row.email_hash}`)
        ? "1"
        : "0",
    ),
  ])

  return {
    headers,
    rows,
    emailHashes: people.map(({ row }) => row.email_hash),
    sessionIds: sessions.map((session) => session.id),
  }
}
