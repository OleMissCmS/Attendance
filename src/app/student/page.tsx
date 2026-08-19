import { saveStudentEmail } from "@/app/c/actions"
import { SiteChrome } from "@/components/site-chrome"
import { getRememberedEmail } from "@/lib/device"
import { hashEmail } from "@/lib/pii"
import { allowTestStudentCheckIn } from "@/lib/test-mode"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

type LiveClass = {
  course_code: string
  course_name: string
  section_label: string
  session_id: string | null
}

export default async function StudentHomePage() {
  const email = await getRememberedEmail()
  const supabase = await createClient()
  const classes: LiveClass[] = []

  if (email) {
    const { data } = await supabase.rpc("student_live_classes", {
      p_email_hash: hashEmail(email),
      p_is_test: allowTestStudentCheckIn(email),
    })
    if (Array.isArray(data)) {
      classes.push(...(data as LiveClass[]))
    }
  }

  return (
    <SiteChrome profile={null}>
      <main className="mx-auto max-w-[36rem] space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold">My classes</h1>
          <p className="text-muted-foreground">
            Enter the email on your roster. You do not need to verify it. When
            class is live, open Check in and type the code from the classroom
            screen.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your email</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={saveStudentEmail} className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1 space-y-1">
                <Label htmlFor="email">School email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  placeholder="(e.g. you@go.olemiss.edu)"
                />
              </div>
              <Button type="submit">Save</Button>
            </form>
          </CardContent>
        </Card>
        {email ? (
          <div className="space-y-3">
            {classes.length ? (
              classes.map((item) => (
                <Card key={`${item.course_code}-${item.section_label}`}>
                  <CardHeader>
                    <CardTitle>
                      {item.course_code} — {item.course_name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      {item.section_label}
                    </p>
                    {item.session_id ? (
                      <Button asChild>
                        <Link href={`/c/${item.session_id}`}>
                          Check in
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No live session
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground">
                No classes found for {email}. Ask your instructor to add that
                address to the roster.
              </p>
            )}
          </div>
        ) : null}
      </main>
    </SiteChrome>
  )
}
