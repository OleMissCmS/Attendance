import { EXPERIENCE_ROSTER_UNSUPPORTED_MESSAGE } from "@/lib/blackboard-roster"
import { RosterExperienceNote } from "@/components/roster-experience-note"
import { SiteChrome } from "@/components/site-chrome"
import {
  addRoster,
  endSession,
  removeEnrollment,
  resolveRosterAddRequest,
  startSession,
} from "@/app/faculty/actions"
import { decryptEnrollment, decryptPii } from "@/lib/pii"
import { compareRosterAlphabetically } from "@/lib/roster-diff"
import { formatSectionLabel } from "@/lib/section-label"
import {
  formatSessionTiming,
} from "@/lib/session-times"
import { formatCentralTime } from "@/lib/time"
import { requireFaculty } from "@/lib/auth"
import { canManageAttendanceData } from "@/lib/faculty-email"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; synced?: string }>
}) {
  const profile = await requireFaculty()
  const canManage = canManageAttendanceData(profile.role)
  const { id } = await params
  const { error, synced } = await searchParams
  const sectionId = Number(id)
  const supabase = await createClient()

  const { data: section } = await supabase
    .from("sections")
    .select("*, courses(*)")
    .eq("id", sectionId)
    .maybeSingle()

  if (
    !section ||
    !section.courses ||
    section.deleted_at ||
    section.courses.deleted_at
  ) {
    notFound()
  }

  const [
    { data: enrollments },
    { data: sessions },
    { data: addRequests },
    { data: missAttempts },
  ] = await Promise.all([
    supabase
      .from("enrollments")
      .select("*")
      .eq("section_id", sectionId),
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("section_id", sectionId)
      .order("started_at", { ascending: false }),
    supabase
      .from("roster_add_requests")
      .select("*")
      .eq("section_id", sectionId)
      .eq("status", "pending")
      .order("created_at"),
    supabase
      .from("roster_miss_attempts")
      .select("*")
      .eq("section_id", sectionId)
      .order("created_at", { ascending: false })
      .limit(40),
  ])

  const live = sessions?.find((session) => !session.ended_at)
  const course = section.courses
  // Names are encrypted at rest, so sort after decrypt (not by created_at).
  const sortedEnrollments = [...(enrollments ?? [])].sort((a, b) =>
    compareRosterAlphabetically(decryptEnrollment(a), decryptEnrollment(b)),
  )

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[50rem] space-y-6 px-4 py-8">
        <div>
          <Button
            asChild
            size="lg"
            className="h-12 px-6 text-base font-extrabold"
          >
            <Link href="/faculty">Back to Courses</Link>
          </Button>
          <h1 className="mt-4 text-2xl font-extrabold">
            {course.code} {course.name}
          </h1>
          <p className="text-muted-foreground">{formatSectionLabel(section)}</p>
        </div>

        {error === "request" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            Could not update that roster request. Try again.
          </p>
        ) : null}
        {error === "experience_roster" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            {EXPERIENCE_ROSTER_UNSUPPORTED_MESSAGE}
          </p>
        ) : null}
        {synced === "1" ? (
          <p className="text-sm font-medium text-[#000D26]">
            Roster updated from your file comparison.
          </p>
        ) : null}

        {addRequests?.length ? (
          <Card className="border-rose-200 bg-rose-50">
            <CardHeader>
              <CardTitle>Roster Add Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {addRequests.map((row) => {
                  const student = decryptEnrollment(row)
                  const checkInEmail = decryptPii(row.check_in_email_cipher)
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="font-extrabold text-[#000D26]">
                          {student.lastName && student.firstName
                            ? `${student.lastName}, ${student.firstName}`
                            : student.name || student.email}
                        </p>
                        <p className="text-muted-foreground">
                          {[
                            student.username && `Network ID ${student.username}`,
                            student.studentId && `ID ${student.studentId}`,
                            student.email,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {checkInEmail &&
                        checkInEmail.toLowerCase() !==
                          student.email.toLowerCase() ? (
                          <p className="text-xs text-amber-900">
                            Checked in as {checkInEmail}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        {canManage ? (
                          <>
                        <form action={resolveRosterAddRequest}>
                          <input type="hidden" name="section_id" value={sectionId} />
                          <input type="hidden" name="request_id" value={row.id} />
                          <input type="hidden" name="accept" value="1" />
                          <Button type="submit" size="sm">
                            Add
                          </Button>
                        </form>
                        <form action={resolveRosterAddRequest}>
                          <input type="hidden" name="section_id" value={sectionId} />
                          <input type="hidden" name="request_id" value={row.id} />
                          <input type="hidden" name="accept" value="0" />
                          <Button type="submit" size="sm" variant="outline">
                            Reject
                          </Button>
                        </form>
                          </>
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Pending
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {missAttempts?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Not-on-roster check-ins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Emails students tried when check-in said they were not on this
                roster (or when a roster-add found they already were).
              </p>
              <ul className="divide-y">
                {missAttempts.map((row) => {
                  const attempted =
                    decryptPii(row.attempted_email_cipher) || "(unknown)"
                  const when = formatCentralTime(row.created_at)
                  const sourceLabel =
                    row.source === "roster_add_enrolled"
                      ? "Already on roster (add form)"
                      : "Not on roster (check-in)"
                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap justify-between gap-2 py-2"
                    >
                      <div>
                        <p className="font-medium text-[#000D26]">{attempted}</p>
                        <p className="text-xs text-muted-foreground">
                          {sourceLabel}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">{when}</p>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Attendance session</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {live ? (
              <>
                <Button asChild>
                  <Link href={`/faculty/sessions/${live.id}/display`}>
                    Start Session
                  </Link>
                </Button>
                <form action={endSession}>
                  <input type="hidden" name="session_id" value={live.id} />
                  <input type="hidden" name="section_id" value={sectionId} />
                  <Button type="submit" variant="outline">
                    End session
                  </Button>
                </form>
              </>
            ) : (
              <form action={startSession}>
                <input type="hidden" name="section_id" value={sectionId} />
                <Button type="submit">Start session</Button>
              </form>
            )}
          </CardContent>
        </Card>
        ) : live ? (
          <Card>
            <CardHeader>
              <CardTitle>Attendance session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                A session is currently live. Advisors can view reports; only
                instructors and guests can run check-in.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Roster ({sortedEnrollments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  When enrollment changes, upload a fresh Blackboard Grade
                  Center file with Username or Student Email Address and choose
                  who to add, remove, or keep.
                </p>
                <RosterExperienceNote className="text-sm" />
                <Button asChild>
                  <Link href={`/faculty/sections/${sectionId}/roster-sync`}>
                    Update roster from Blackboard
                  </Link>
                </Button>
                <details className="rounded-md border px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">
                    Quick add only (no removals)
                  </summary>
                  <form action={addRoster} className="mt-3 space-y-3">
                    <input type="hidden" name="section_id" value={sectionId} />
                    <div className="space-y-1">
                      <Label htmlFor="roster_file">
                        Blackboard Grade Center file (.xlsx, .xls, .csv)
                      </Label>
                      <Input
                        id="roster_file"
                        name="roster_file"
                        type="file"
                        accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      />
                      <RosterExperienceNote />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="roster">Or paste roster text</Label>
                      <Textarea
                        id="roster"
                        name="roster"
                        rows={4}
                        placeholder="(e.g. Last Name\tFirst Name\tUsername\tStudent ID)"
                      />
                    </div>
                    <Button type="submit" variant="secondary">
                      Add new students only
                    </Button>
                  </form>
                </details>
              </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  View-only roster. Advisors cannot add or remove students.
                </p>
              )}
              <ul className="divide-y text-sm">
                {sortedEnrollments.map((row) => {
                  const student = decryptEnrollment(row)
                  return (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <span>
                        {[
                          student.lastName && student.firstName
                            ? `${student.lastName}, ${student.firstName}`
                            : student.name,
                          student.username,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {canManage ? (
                      <form action={removeEnrollment}>
                        <input type="hidden" name="section_id" value={sectionId} />
                        <input
                          type="hidden"
                          name="enrollment_id"
                          value={row.id}
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          Remove
                        </Button>
                      </form>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Past Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {sessions?.length ? (
                  sessions.map((session) => {
                    const timing = formatSessionTiming(
                      session.started_at,
                      session.ended_at,
                    )
                    const reportHref = `/faculty/reports?${new URLSearchParams({
                      course: String(course.id),
                      section: String(sectionId),
                      session: session.id,
                    })}`
                    return (
                      <li key={session.id}>
                        <Link
                          href={reportHref}
                          className="block rounded-md px-2 py-1.5 font-medium text-primary underline underline-offset-4 hover:bg-muted"
                        >
                          {timing.date} · {timing.startTime}–{timing.stopTime} (
                          {timing.duration})
                        </Link>
                      </li>
                    )
                  })
                ) : (
                  <li className="text-muted-foreground">No sessions yet</li>
                )}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </SiteChrome>
  )
}
