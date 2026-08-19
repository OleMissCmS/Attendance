import { CheckInForm } from "@/components/check-in-form"
import { RosterAddRequestForm } from "@/components/roster-add-request-form"
import { SiteChrome } from "@/components/site-chrome"
import { getRememberedEmail } from "@/lib/device"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{
    t?: string
    error?: string
    done?: string
    at?: string
    test?: string
    email?: string
    requested?: string
    request?: string
  }>
}) {
  const { sessionId } = await params
  const { t, error, done, at, test, email: emailParam, requested, request } =
    await searchParams
  const remembered = await getRememberedEmail()
  const email = emailParam?.trim().toLowerCase() || remembered
  const supabase = await createClient()

  const { data, error: infoError } = await supabase.rpc("live_session_info", {
    p_session_id: sessionId,
  })
  if (infoError || !data) notFound()

  const info = data as {
    course_code: string
    course_name: string
    section_label: string
    ended: boolean
  }
  const notOnRoster = error === "not_roster"
  const requestError =
    request === "missing"
      ? "Enter last name, first name, network ID, student ID, and email."
      : request === "failed"
        ? "Could not submit that request. Try again."
        : undefined

  return (
    <SiteChrome profile={null}>
      <div className="flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-[24rem]">
          <CardHeader>
            <CardTitle>Check in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Class: </span>
                {info.course_code} {info.course_name}
              </p>
              <p>
                <span className="text-muted-foreground">Section: </span>
                {info.section_label}
              </p>
            </div>
            {done === "1" ? (
              <div
                role="status"
                className="space-y-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                <p className="font-extrabold">You are checked in.</p>
                <p>
                  Checked in to {info.course_code} · {info.section_label}
                  {at
                    ? ` at ${new Date(at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}.`
                    : "."}
                </p>
                {test === "1" ? (
                  <p>
                    Checked in as Test@test.com. Faculty reports can find this
                    row by searching Test@test.com.
                  </p>
                ) : null}
                <p>This phone cannot check in a different student.</p>
              </div>
            ) : requested === "1" ? (
              <div
                role="status"
                className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900"
              >
                <p className="font-extrabold">Roster addition requested.</p>
                <p>
                  Your instructor can add you to this section. If they accept,
                  you will be marked present for this session.
                </p>
              </div>
            ) : notOnRoster ? (
              <RosterAddRequestForm
                sessionId={sessionId}
                email={email}
                error={requestError}
              />
            ) : info.ended ? (
              <p role="alert" className="text-sm text-destructive">
                This session has ended.
              </p>
            ) : (
              <CheckInForm
                sessionId={sessionId}
                email={email}
                token={t?.toUpperCase() ?? ""}
                error={error}
              />
            )}
            <p className="text-center text-sm">
              <Link href="/student" className="underline-offset-4 hover:underline">
                Back to My classes
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </SiteChrome>
  )
}
