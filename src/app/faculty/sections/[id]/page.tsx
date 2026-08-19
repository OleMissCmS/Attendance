import { SiteChrome } from "@/components/site-chrome"
import {
  addRoster,
  endSession,
  removeEnrollment,
  startSession,
} from "@/app/faculty/actions"
import { decryptEnrollment } from "@/lib/pii"
import { formatSectionLabel } from "@/lib/section-label"
import {
  formatSessionTiming,
} from "@/lib/session-times"
import { requireFaculty } from "@/lib/auth"
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
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireFaculty()
  const { id } = await params
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

  const [{ data: enrollments }, { data: sessions }] = await Promise.all([
    supabase
      .from("enrollments")
      .select("*")
      .eq("section_id", sectionId)
      .order("created_at"),
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("section_id", sectionId)
      .order("started_at", { ascending: false }),
  ])

  const live = sessions?.find((session) => !session.ended_at)
  const course = section.courses

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

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Roster ({enrollments?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={addRoster} className="space-y-3">
                <input type="hidden" name="section_id" value={sectionId} />
                <div className="space-y-1">
                  <Label htmlFor="roster_file">Blackboard Grade Center file</Label>
                  <Input
                    id="roster_file"
                    name="roster_file"
                    type="file"
                    accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                  <p className="text-xs text-muted-foreground">
                    CSV, XLS, or XLSX. Student columns stay the same; assignment
                    columns are ignored. Email is Username@go.olemiss.edu.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roster">Or paste Grade Center text</Label>
                  <Textarea
                    id="roster"
                    name="roster"
                    rows={6}
                    placeholder={
                      "(e.g. Last Name\tFirst Name\tUsername\tStudent ID)"
                    }
                  />
                </div>
                <Button type="submit">Add to roster</Button>
              </form>
              <ul className="divide-y text-sm">
                {enrollments?.map((row) => {
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
