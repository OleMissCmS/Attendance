import { SiteChrome } from "@/components/site-chrome"
import { AttendanceMarkToggle } from "@/components/attendance-mark-toggle"
import { DownloadButton } from "@/components/download-button"
import {
  ReportAtRiskThreshold,
  ReportFlagsFilter,
  ReportLiveFilters,
} from "@/components/report-live-filters"
import { requireFaculty } from "@/lib/auth"
import {
  currentAbsenceStreak,
  maxConsecutiveAbsences,
} from "@/lib/attendance-stats"
import { buildBlackboardGradeCenter } from "@/lib/blackboard-export"
import { loadAuthorizedCourses } from "@/lib/faculty-access"
import { decryptEnrollment, decryptPii, usernameFromEmail } from "@/lib/pii"
import { formatSectionLabel } from "@/lib/section-label"
import { formatSessionTiming } from "@/lib/session-times"
import {
  matchesStudentLookup,
  studentLookupHashes,
} from "@/lib/student-identity"
import { createClient } from "@/lib/supabase/server"
import { formatCentralDateTime } from "@/lib/time"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CourseRef = { code: string; name: string; deleted_at?: string | null }

const STUDENT_HEADERS = [
  "Last Name",
  "First Name",
  "Username",
  "Student ID",
] as const

const reportCardClass = "min-w-0 overflow-hidden pt-0"
const reportHeaderClass =
  "flex flex-col gap-2 bg-[#000D26] px-4 py-2 text-white sm:flex-row sm:items-center sm:justify-between"
const reportTitleClass = "text-white"
const reportHintClass = "mt-1 text-sm text-white/75"
const altReportHeaderClass =
  "flex flex-col gap-2 bg-[#A1C6E7] px-4 py-2 text-[#000D26] sm:flex-row sm:items-center sm:justify-between"
const altReportTitleClass = "text-[#000D26]"
const altReportHintClass = "mt-1 text-sm text-[#000D26]/75"
const altReportActionsClass = "flex flex-wrap items-center gap-3"

function courseFromRelation(value: CourseRef | CourseRef[] | null | undefined) {
  const course = Array.isArray(value) ? value[0] : value
  if (!course || course.deleted_at) return null
  return course
}

function courseLabel(course: CourseRef | null) {
  return course ? `${course.code} ${course.name}` : ""
}

function deviceFlagLabel(flag: {
  flag_type: string
  bound_email_cipher: string
  attempted_email_cipher: string
}) {
  if (flag.flag_type === "late_device") {
    return "New phone after 4th class"
  }
  if (flag.flag_type === "device_conflict") {
    return "Phone already used by another student"
  }
  return flag.flag_type
}

function combineFlagLabels(parts: string[]) {
  return parts.filter(Boolean).join("; ") || "—"
}

function studentLookupFromFilter(value: string) {
  return studentLookupHashes(value)
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    course?: string
    section?: string
    from?: string
    to?: string
    student?: string
    flags?: string
    streak?: string
    session?: string
  }>
}) {
  const profile = await requireFaculty()
  const filters = await searchParams
  const supabase = await createClient()

  const authorized = await loadAuthorizedCourses(profile.id)
  const courses = authorized.map((course) => ({
    id: course.id,
    code: course.code,
    name: course.name,
  }))
  const activeSections = authorized.flatMap((course) =>
    course.sections.map((section) => ({
      ...section,
      courses: {
        code: course.code,
        name: course.name,
        deleted_at: course.deleted_at,
      },
    })),
  )

  const courseId = filters.course ? Number(filters.course) : undefined
  const sectionId = filters.section ? Number(filters.section) : undefined
  const matchedSections = activeSections.filter((section) => {
    if (courseId && section.course_id !== courseId) return false
    if (sectionId) return section.id === sectionId
    return true
  })
  const sections = matchedSections

  const studentQuery = (filters.student ?? "").trim()
  const studentHashes = studentLookupFromFilter(studentQuery)
  const flagFilter = filters.flags ?? "all"
  const streakThreshold = Math.max(1, Number(filters.streak) || 3)

  const sectionIds = sections.map((section) => section.id)
  const { data: enrollments } = sectionIds.length
    ? await supabase.from("enrollments").select("*").in("section_id", sectionIds)
    : { data: [] }

  const sessionId = (filters.session ?? "").trim()

  const authorizedSectionIds = activeSections.map((section) => section.id)
  const { data: filterSessionRows } = authorizedSectionIds.length
    ? await supabase
        .from("attendance_sessions")
        .select("id, started_at, ended_at, section_id")
        .in("section_id", authorizedSectionIds)
        .order("started_at", { ascending: true })
    : { data: [] }

  const sessionOptions = (filterSessionRows ?? []).flatMap((session) => {
    const section = activeSections.find((item) => item.id === session.section_id)
    if (!section) return []
    const course = courseFromRelation(section.courses)
    return [
      {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        section_id: session.section_id,
        course_id: section.course_id,
        courseCode: course?.code ?? "",
        sectionLabel: formatSectionLabel(section),
      },
    ]
  })

  let sessionQuery = supabase
    .from("attendance_sessions")
    .select("*")
    .order("started_at", { ascending: true })
  if (sectionIds.length) sessionQuery = sessionQuery.in("section_id", sectionIds)
  if (sessionId) {
    sessionQuery = sessionQuery.eq("id", sessionId)
  } else {
    if (filters.from) {
      sessionQuery = sessionQuery.gte("started_at", `${filters.from}T00:00:00`)
    }
    if (filters.to) {
      sessionQuery = sessionQuery.lte("started_at", `${filters.to}T23:59:59`)
    }
  }
  const { data: sessions } = sectionIds.length
    ? await sessionQuery
    : { data: [] }

  const sessionIds = sessions?.map((session) => session.id) ?? []
  const { data: records } = sessionIds.length
    ? await supabase
        .from("attendance_records")
        .select("*")
        .in("session_id", sessionIds)
    : { data: [] }

  const { data: deviceFlags } = sessionIds.length
    ? await supabase
        .from("attendance_flags")
        .select("*")
        .in("session_id", sessionIds)
    : { data: [] as {
        attempted_email_cipher: string
        attempted_email_hash: string
        bound_email_cipher: string
        bound_email_hash: string
        created_at: string
        device_id: string | null
        flag_type: string
        id: number
        section_id: number
        session_id: string
      }[] }

  const lateFlagsByKey = new Map<
    string,
    NonNullable<typeof deviceFlags>[number]
  >()
  const conflictFlags: NonNullable<typeof deviceFlags> = []
  for (const flag of deviceFlags ?? []) {
    if (flag.flag_type === "late_device") {
      lateFlagsByKey.set(`${flag.session_id}:${flag.attempted_email_hash}`, flag)
    } else if (flag.flag_type === "device_conflict") {
      conflictFlags.push(flag)
    }
  }

  const presentKeys = new Set(
    (records ?? []).map((record) => `${record.session_id}:${record.email_hash}`),
  )

  type StudentRow = {
    course: string
    section: string
    lastName: string
    firstName: string
    username: string
    studentId: string
  }

  const noShowRows: (StudentRow & {
    attended: number
    missed: number
    session_count: number
  })[] = []

  const atRiskRows: (StudentRow & {
    streak: number
    current_streak: number
    attended: number
    missed: number
  })[] = []

  const flagRows: (StudentRow & {
    session_date: string
    checked_in_at: string
    flags: string
    flagged: boolean
    linkedPhoneEmail: string
    attemptedSignInEmail: string
  })[] = []

  const sessionLogRows =
    sessions?.map((session) => {
      const section = sections.find((item) => item.id === session.section_id)
      const course = courseFromRelation(section?.courses)
      const timing = formatSessionTiming(session.started_at, session.ended_at)
      return {
        course: courseLabel(course),
        section: formatSectionLabel(section ?? {}),
        date: timing.date,
        startTime: timing.startTime,
        stopTime: timing.stopTime,
        duration: timing.duration,
      }
    }) ?? []

  const gradeGrids = sections.map((section) => {
    const course = courseFromRelation(section.courses)
    const courseName = courseLabel(course)
    const sectionLabel = formatSectionLabel(section)
    const sectionEnrollments = (enrollments ?? []).filter(
      (row) => row.section_id === section.id,
    )
    const sectionSessions = (sessions ?? []).filter(
      (session) => session.section_id === section.id,
    )
    const rosterHashes = new Set(
      sectionEnrollments.map((row) => row.email_hash),
    )
    const walkIns = (records ?? [])
      .filter(
        (record) =>
          sectionSessions.some((session) => session.id === record.session_id) &&
          !rosterHashes.has(record.email_hash) &&
          matchesStudentLookup(record.email_hash, studentHashes),
      )
      .reduce(
        (unique, record) => {
          if (unique.some((row) => row.email_hash === record.email_hash)) {
            return unique
          }
          unique.push({
            email_hash: record.email_hash,
            email_cipher: record.email_cipher,
            name_cipher: null,
            last_name_cipher: null,
            first_name_cipher: null,
            username_cipher: null,
            student_id_cipher: null,
          })
          return unique
        },
        [] as {
          email_hash: string
          email_cipher: string
          name_cipher: string | null
          last_name_cipher: string | null
          first_name_cipher: string | null
          username_cipher: string | null
          student_id_cipher: string | null
        }[],
      )
    const people = [...sectionEnrollments, ...walkIns]
    const grid = buildBlackboardGradeCenter({
      enrollments: people,
      sessions: sectionSessions,
      presentKeys,
      studentHashes: studentHashes.length ? studentHashes : undefined,
    })
    const headers = ["Course", "Section", ...grid.headers]
    const rows = grid.rows.map((row) => [courseName, sectionLabel, ...row])
    const identityColumns = 6
    return {
      id: section.id,
      course: courseName,
      section: sectionLabel,
      sessionCount: sectionSessions.length,
      headers,
      rows,
      identityColumns,
      emailHashes: grid.emailHashes,
      sessionIds: grid.sessionIds,
    }
  })

  for (const section of sections) {
    const course = courseFromRelation(section.courses)
    const courseName = courseLabel(course)
    const sectionLabel = formatSectionLabel(section)
    const sectionEnrollments = (enrollments ?? []).filter(
      (row) => row.section_id === section.id,
    )
    const sectionSessions = (sessions ?? []).filter(
      (session) => session.section_id === section.id,
    )
    const oldestFirst = [...sectionSessions].sort((a, b) =>
      a.started_at.localeCompare(b.started_at),
    )
    const newestFirst = [...oldestFirst].reverse()

    for (const enrollment of sectionEnrollments) {
      if (!matchesStudentLookup(enrollment.email_hash, studentHashes)) continue
      const student = decryptEnrollment(enrollment)
      const identity: StudentRow = {
        course: courseName,
        section: sectionLabel,
        lastName: student.lastName,
        firstName: student.firstName,
        username: student.username,
        studentId: student.studentId,
      }
      const presentIds = new Set(
        (records ?? [])
          .filter(
            (record) =>
              record.email_hash === enrollment.email_hash &&
              oldestFirst.some((session) => session.id === record.session_id),
          )
          .map((record) => record.session_id),
      )
      const attended = presentIds.size
      const missed = oldestFirst.length - attended
      noShowRows.push({
        ...identity,
        attended,
        missed,
        session_count: oldestFirst.length,
      })

      if (oldestFirst.length) {
        const streak = maxConsecutiveAbsences(oldestFirst, presentIds)
        const current = currentAbsenceStreak(newestFirst, presentIds)
        if (streak >= streakThreshold) {
          atRiskRows.push({
            ...identity,
            streak,
            current_streak: current,
            attended,
            missed,
          })
        }
      }

      for (const session of oldestFirst) {
        const record = records?.find(
          (item) =>
            item.session_id === session.id &&
            item.email_hash === enrollment.email_hash,
        )
        if (!record) continue
        const lateFlag = lateFlagsByKey.get(
          `${record.session_id}:${record.email_hash}`,
        )
        const labels: string[] = []
        if (record.is_incognito) labels.push("Private/incognito browser")
        if (lateFlag) labels.push(deviceFlagLabel(lateFlag))
        const hasLate = Boolean(lateFlag)
        const hasIncognito = Boolean(record.is_incognito)
        const flagged = hasIncognito || hasLate
        if (flagFilter === "flagged" && !flagged) continue
        if (flagFilter === "incognito" && !hasIncognito) continue
        if (flagFilter === "late" && !hasLate) continue
        if (flagFilter === "conflict") continue
        const timing = formatSessionTiming(session.started_at, session.ended_at)
        flagRows.push({
          ...identity,
          session_date: timing.date,
          checked_in_at: formatCentralDateTime(record.checked_in_at),
          flags: combineFlagLabels(labels),
          flagged,
          linkedPhoneEmail: "—",
          attemptedSignInEmail: "—",
        })
      }
    }
  }

  for (const flag of conflictFlags) {
    if (
      studentHashes.length &&
      !matchesStudentLookup(flag.bound_email_hash, studentHashes) &&
      !matchesStudentLookup(flag.attempted_email_hash, studentHashes)
    ) {
      continue
    }
    if (flagFilter === "incognito" || flagFilter === "late") continue
    const session = sessions?.find((item) => item.id === flag.session_id)
    if (!session) continue
    const section = sections.find((item) => item.id === session.section_id)
    if (!section) continue
    const course = courseFromRelation(section.courses)
    const linkedPhoneEmail =
      decryptPii(flag.bound_email_cipher) || "(unknown)"
    const attemptedSignInEmail =
      decryptPii(flag.attempted_email_cipher) || "(unknown)"
    const enrollment =
      (enrollments ?? []).find(
        (row) =>
          row.section_id === section.id &&
          row.email_hash === flag.bound_email_hash,
      ) ??
      (enrollments ?? []).find(
        (row) =>
          row.section_id === section.id &&
          row.email_hash === flag.attempted_email_hash,
      ) ??
      null
    const student = enrollment
      ? decryptEnrollment(enrollment)
      : {
          lastName: "",
          firstName: "",
          username: usernameFromEmail(linkedPhoneEmail) || linkedPhoneEmail,
          studentId: "",
          email: linkedPhoneEmail,
          name: linkedPhoneEmail,
        }
    const timing = formatSessionTiming(session.started_at, session.ended_at)
    flagRows.push({
      course: courseLabel(course),
      section: formatSectionLabel(section),
      lastName: student.lastName,
      firstName: student.firstName,
      username: student.username,
      studentId: student.studentId,
      session_date: timing.date,
      checked_in_at: formatCentralDateTime(flag.created_at),
      flags: deviceFlagLabel(flag),
      flagged: true,
      linkedPhoneEmail,
      attemptedSignInEmail,
    })
  }

  noShowRows.sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName) ||
      a.firstName.localeCompare(b.firstName),
  )
  atRiskRows.sort((a, b) => b.streak - a.streak || b.current_streak - a.current_streak)

  const singleSection = sectionId
    ? sections.find((section) => section.id === sectionId)
    : undefined
  const blackboard = singleSection
    ? buildBlackboardGradeCenter({
        enrollments: (enrollments ?? []).filter(
          (row) => row.section_id === singleSection.id,
        ),
        sessions: (sessions ?? []).filter(
          (session) => session.section_id === singleSection.id,
        ),
        presentKeys,
        studentHashes: studentHashes.length ? studentHashes : undefined,
      })
    : {
        headers: [...STUDENT_HEADERS],
        rows: [] as string[][],
      }

  const stickyCol =
    "sticky left-0 z-10 bg-card shadow-[1px_0_0_0] shadow-border"
  const stickyFirst =
    "sticky left-[7.5rem] z-10 bg-card shadow-[1px_0_0_0] shadow-border"
  const stickyUser =
    "sticky left-[15rem] z-10 bg-card shadow-[1px_0_0_0] shadow-border"
  const reportTableScroll = "max-h-[min(70vh,40rem)]"

  function stickyFor(header: string) {
    if (header === "Last Name") return stickyCol
    if (header === "First Name") return stickyFirst
    if (header === "Username") return stickyUser
    return undefined
  }

  const identityHeads = (
    <>
      <TableHead>Course</TableHead>
      <TableHead>Section</TableHead>
      <TableHead className={stickyCol}>Last Name</TableHead>
      <TableHead className={stickyFirst}>First Name</TableHead>
      <TableHead className={stickyUser}>Username</TableHead>
      <TableHead>Student ID</TableHead>
    </>
  )

  const filterBits = [
    courseId
      ? courses.find((course) => course.id === courseId)?.code
      : "All courses",
    sectionId
      ? formatSectionLabel(
          activeSections.find((section) => section.id === sectionId) ?? {},
        )
      : "All sections",
    sessionId
      ? "One check-in session"
      : filters.from
        ? `From ${filters.from}`
        : null,
    sessionId ? null : filters.to ? `To ${filters.to}` : null,
    studentQuery ? `Student “${studentQuery}”` : null,
  ].filter(Boolean)
  const emptyStudentMessage = studentQuery
    ? `No students match “${studentQuery}” in this section`
    : "No rostered students for these filters, or no sessions have occurred yet."
  const selectedSession = sessionId
    ? sessionOptions.find((session) => session.id === sessionId)
    : undefined
  const selectedSessionTiming = selectedSession
    ? formatSessionTiming(selectedSession.started_at, selectedSession.ended_at)
    : null
  const dateRangeLabel = sessionId
    ? selectedSessionTiming
      ? `${selectedSessionTiming.date} ${selectedSessionTiming.startTime}`
      : "one session"
    : filters.from || filters.to
      ? `${filters.from || "…"} to ${filters.to || "…"}`
      : "all dates"

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto min-w-0 max-w-[62rem] space-y-6 px-4 py-8">
        <h1 className="text-2xl font-extrabold">Attendance Reports</h1>
        <Card>
          <CardHeader>
            <CardTitle>Optional filters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Leave course and section blank to include all data you are
              authorized to see. Results update as you change filters.
              Blackboard download needs one section.
            </p>
          </CardHeader>
          <CardContent>
            <ReportLiveFilters
              courses={courses}
              sections={activeSections.map((section) => ({
                id: section.id,
                course_id: section.course_id,
                term: section.term,
                section_number: section.section_number,
                label: section.label,
                courseCode: courseFromRelation(section.courses)?.code ?? "",
              }))}
              sessions={sessionOptions}
              current={{
                course: filters.course,
                section:
                  courseId &&
                  sectionId &&
                  !activeSections.some(
                    (section) =>
                      section.id === sectionId &&
                      section.course_id === courseId,
                  )
                    ? ""
                    : (filters.section ?? ""),
                session: sessionId,
                from: filters.from,
                to: filters.to,
                student: filters.student,
                flags: flagFilter,
                streak: filters.streak,
              }}
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <p>
            Active filters: {filterBits.join(" · ")}. Date range:{" "}
            {dateRangeLabel}.
          </p>
          <a
            href="/faculty/reports"
            className="font-bold text-[#000D26] underline-offset-4 hover:underline"
          >
            Clear filters
          </a>
        </div>
            {gradeGrids.map((grid) => (
              <Card key={grid.id} className={reportCardClass}>
                <CardHeader className={reportHeaderClass}>
                  <div>
                    <CardTitle className={reportTitleClass}>
                      {grid.course} · {grid.section}
                    </CardTitle>
                    <p className={reportHintClass}>
                      Scroll sideways for more date columns. {grid.rows.length}{" "}
                      students. Date range: {dateRangeLabel}. Grid CSV is the
                      on-screen table; Blackboard files are Grade Center upload
                      format. Click a 1 or 0 in a session column to mark present
                      or absent.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sectionId === grid.id ? (
                      <>
                        <DownloadButton
                          onNavy
                          filename="blackboard-attendance.csv"
                          label="Download for Blackboard"
                          headers={blackboard.headers}
                          rows={blackboard.rows}
                        />
                        <DownloadButton
                          onNavy
                          filename="blackboard-attendance.xlsx"
                          label="Download XLSX"
                          format="xlsx"
                          headers={blackboard.headers}
                          rows={blackboard.rows}
                        />
                      </>
                    ) : null}
                    <DownloadButton
                      onNavy
                      filename={`${grid.course}-${grid.section}-attendance.csv`.replaceAll(
                        " ",
                        "-",
                      )}
                      label="Download grid CSV"
                      headers={grid.headers}
                      rows={grid.rows}
                    />
                  </div>
                </CardHeader>
                <CardContent className="min-w-0">
                  {!sectionId ? (
                    <p className="mb-3 text-sm text-muted-foreground">
                      Select this section in Filters to download a Blackboard
                      Grade Center file. Files cannot mix courses or sections.
                    </p>
                  ) : null}
                  <Table containerClassName={reportTableScroll}>
                    <TableHeader>
                      <TableRow>
                        {grid.headers.map((header) => (
                          <TableHead
                            key={header}
                            className={stickyFor(header)}
                          >
                            {header}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grid.rows.length ? (
                        grid.rows.map((row, index) => (
                          <TableRow
                            key={`${grid.id}-${row[4] || row[2]}-${index}`}
                          >
                            {row.map((cell, cellIndex) => {
                              const sessionOffset =
                                cellIndex - grid.identityColumns
                              const canEdit =
                                sessionOffset >= 0 &&
                                sessionOffset < grid.sessionIds.length
                              return (
                                <TableCell
                                  key={`${grid.id}-${index}-${cellIndex}`}
                                  className={
                                    stickyFor(grid.headers[cellIndex])
                                  }
                                >
                                  {canEdit ? (
                                    <AttendanceMarkToggle
                                      sessionId={grid.sessionIds[sessionOffset]}
                                      emailHash={grid.emailHashes[index]}
                                      present={cell === "1"}
                                    />
                                  ) : cell === "" ? (
                                    "—"
                                  ) : (
                                    cell
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={Math.max(grid.headers.length, 6)}>
                            {grid.sessionCount
                              ? emptyStudentMessage
                              : "No check-in sessions started yet for this section."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
            {!gradeGrids.length ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  No sections match these filters.
                </CardContent>
              </Card>
            ) : null}

        <Card className="overflow-hidden border-[#333F58]/30 pt-0">
          <CardHeader className="space-y-1 bg-[#000D26] px-4 py-2 text-white">
            <CardTitle className={reportTitleClass}>Alternative Reports</CardTitle>
            <p className={reportHintClass}>
              No Show, At Risk, and Flagged / Session log use the same filters
              as the attendance grid and update as you change them.
            </p>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <Card className={reportCardClass}>
              <CardHeader className={altReportHeaderClass}>
                <CardTitle className={altReportTitleClass}>No Show report</CardTitle>
                <DownloadButton
                  filename="no-show-report.csv"
                  label="Download CSV"
                  headers={[
                    "Course",
                    "Section",
                    ...STUDENT_HEADERS,
                    "Attended",
                    "Missed",
                    "Sessions",
                  ]}
                  rows={noShowRows.map((row) => [
                    row.course,
                    row.section,
                    row.lastName,
                    row.firstName,
                    row.username,
                    row.studentId,
                    String(row.attended),
                    String(row.missed),
                    String(row.session_count),
                  ])}
                />
              </CardHeader>
              <CardContent className="min-w-0">
                <Table containerClassName={reportTableScroll}>
                  <TableHeader>
                    <TableRow>
                      {identityHeads}
                      <TableHead>Attended</TableHead>
                      <TableHead>Missed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noShowRows.length ? (
                      noShowRows.map((row) => (
                        <TableRow
                          key={`${row.course}-${row.section}-${row.username}`}
                        >
                          <TableCell className={stickyCol}>{row.course}</TableCell>
                          <TableCell>{row.section}</TableCell>
                          <TableCell>{row.lastName || "—"}</TableCell>
                          <TableCell>{row.firstName || "—"}</TableCell>
                          <TableCell>{row.username || "—"}</TableCell>
                          <TableCell>{row.studentId || "—"}</TableCell>
                          <TableCell>{row.attended}</TableCell>
                          <TableCell>{row.missed}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8}>
                          {emptyStudentMessage}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className={reportCardClass}>
              <CardHeader className={altReportHeaderClass}>
                <div>
                  <CardTitle className={altReportTitleClass}>At Risk report</CardTitle>
                  <p className={altReportHintClass}>
                    Students with {streakThreshold} or more consecutive absences
                    in a section. Streaks are not mixed across courses.
                  </p>
                </div>
                <div className={altReportActionsClass}>
                  <ReportAtRiskThreshold
                    current={{
                      course: filters.course,
                      section: filters.section,
                      session: sessionId,
                      from: filters.from,
                      to: filters.to,
                      student: filters.student,
                      flags: flagFilter,
                      streak: filters.streak,
                    }}
                  />
                  <DownloadButton
                    filename="at-risk-report.csv"
                    label="Download CSV"
                    headers={[
                      "Course",
                      "Section",
                      ...STUDENT_HEADERS,
                      "Longest streak",
                      "Current streak",
                      "Attended",
                      "Missed",
                    ]}
                    rows={atRiskRows.map((row) => [
                      row.course,
                      row.section,
                      row.lastName,
                      row.firstName,
                      row.username,
                      row.studentId,
                      String(row.streak),
                      String(row.current_streak),
                      String(row.attended),
                      String(row.missed),
                    ])}
                  />
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <Table containerClassName={reportTableScroll}>
                  <TableHeader>
                    <TableRow>
                      {identityHeads}
                      <TableHead>Longest streak</TableHead>
                      <TableHead>Current streak</TableHead>
                      <TableHead>Attended</TableHead>
                      <TableHead>Missed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atRiskRows.length ? (
                      atRiskRows.map((row) => (
                        <TableRow
                          key={`${row.course}-${row.section}-${row.username}`}
                        >
                          <TableCell className={stickyCol}>{row.course}</TableCell>
                          <TableCell>{row.section}</TableCell>
                          <TableCell>{row.lastName || "—"}</TableCell>
                          <TableCell>{row.firstName || "—"}</TableCell>
                          <TableCell>{row.username || "—"}</TableCell>
                          <TableCell>{row.studentId || "—"}</TableCell>
                          <TableCell>{row.streak}</TableCell>
                          <TableCell>{row.current_streak}</TableCell>
                          <TableCell>{row.attended}</TableCell>
                          <TableCell>{row.missed}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={10}>
                          {sessionLogRows.length
                            ? `No students with ${streakThreshold} consecutive absences.`
                            : "No sessions yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className={reportCardClass}>
              <CardHeader className="flex flex-col gap-2 bg-[#A1C6E7] px-4 py-2 text-[#000D26] sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 max-w-3xl">
                  <CardTitle className={altReportTitleClass}>Flags</CardTitle>
                  <p className={altReportHintClass}>
                    Raised at check-in when something looks unusual. Absent
                    students have no row.
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#000D26]/75">
                    <li>
                      <span className="font-medium text-[#000D26]">
                        Private/incognito browser
                      </span>
                      {" — "}
                      Browser looked like a private/incognito window. Check-in
                      still counts.
                    </li>
                    <li>
                      <span className="font-medium text-[#000D26]">
                        New phone after 4th class
                      </span>
                      {" — "}
                      This phone has never checked this student in before, and
                      the section already has 4 or more earlier meetings.
                      Check-in still counts.
                    </li>
                    <li>
                      <span className="font-medium text-[#000D26]">
                        Phone already used by another student
                      </span>
                      {" — "}
                      Phone is already tied to a different email, or already
                      checked in someone else for this session. Check-in is
                      blocked. Linked phone email and Attempted sign-in email
                      show the mismatch.
                    </li>
                  </ul>
                </div>
                <div className={altReportActionsClass}>
                  <ReportFlagsFilter
                    current={{
                      course: filters.course,
                      section: filters.section,
                      session: sessionId,
                      from: filters.from,
                      to: filters.to,
                      student: filters.student,
                      flags: flagFilter,
                      streak: filters.streak,
                    }}
                  />
                  <DownloadButton
                    filename="attendance-flags.csv"
                    label="Download CSV"
                    headers={[
                      "Course",
                      "Section",
                      ...STUDENT_HEADERS,
                      "Session date",
                      "Checked in",
                      "Flags",
                      "Linked phone email",
                      "Attempted sign-in email",
                    ]}
                    rows={flagRows.map((row) => [
                      row.course,
                      row.section,
                      row.lastName,
                      row.firstName,
                      row.username,
                      row.studentId,
                      row.session_date,
                      row.checked_in_at,
                      row.flags,
                      row.linkedPhoneEmail,
                      row.attemptedSignInEmail,
                    ])}
                  />
                </div>
              </CardHeader>
              <CardContent className="min-w-0">
                <Table containerClassName={reportTableScroll}>
                  <TableHeader>
                    <TableRow>
                      {identityHeads}
                      <TableHead>Session date</TableHead>
                      <TableHead>Checked in</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Linked phone email</TableHead>
                      <TableHead>Attempted sign-in email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {flagRows.length ? (
                      flagRows.map((row, index) => (
                        <TableRow
                          key={`${row.username}-${row.session_date}-${index}`}
                          className={row.flagged ? "bg-amber-50" : undefined}
                        >
                          <TableCell className={row.flagged ? `${stickyCol} bg-amber-50` : stickyCol}>
                            {row.course}
                          </TableCell>
                          <TableCell>{row.section}</TableCell>
                          <TableCell>{row.lastName || "—"}</TableCell>
                          <TableCell>{row.firstName || "—"}</TableCell>
                          <TableCell>{row.username || "—"}</TableCell>
                          <TableCell>{row.studentId || "—"}</TableCell>
                          <TableCell>{row.session_date}</TableCell>
                          <TableCell>{row.checked_in_at}</TableCell>
                          <TableCell>{row.flags}</TableCell>
                          <TableCell>{row.linkedPhoneEmail}</TableCell>
                          <TableCell>{row.attemptedSignInEmail}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={11}>
                          No check-ins match these Session log filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card className={reportCardClass}>
              <CardHeader className={altReportHeaderClass}>
                <div>
                  <CardTitle className={altReportTitleClass}>Session log</CardTitle>
                  <p className={altReportHintClass}>
                    How long each check-in session was open. Flags are listed
                    above, not on the attendance grid.
                  </p>
                </div>
                <DownloadButton
                  filename="session-log.csv"
                  label="Download CSV"
                  headers={[
                    "Course",
                    "Section",
                    "Date started",
                    "Start time",
                    "Stop time",
                    "Duration",
                  ]}
                  rows={sessionLogRows.map((row) => [
                    row.course,
                    row.section,
                    row.date,
                    row.startTime,
                    row.stopTime,
                    row.duration,
                  ])}
                />
              </CardHeader>
              <CardContent className="min-w-0">
                <Table containerClassName={reportTableScroll}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={stickyCol}>Course</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Date started</TableHead>
                      <TableHead>Start time</TableHead>
                      <TableHead>Stop time</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionLogRows.length ? (
                      sessionLogRows.map((row, index) => (
                        <TableRow key={`${row.course}-${row.section}-${index}`}>
                          <TableCell className={stickyCol}>{row.course}</TableCell>
                          <TableCell>{row.section}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell>{row.startTime}</TableCell>
                          <TableCell>{row.stopTime}</TableCell>
                          <TableCell>{row.duration}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6}>
                          No sessions yet for the selected filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </main>
    </SiteChrome>
  )
}
