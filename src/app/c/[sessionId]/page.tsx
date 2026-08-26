import { CheckInForm } from "@/components/check-in-form"
import { RosterAddRequestForm } from "@/components/roster-add-request-form"
import { SiteChrome } from "@/components/site-chrome"
import { getRememberedEmail } from "@/lib/device"
import { hasRosterAddEligibility } from "@/lib/roster-add-eligibility"
import { createClient } from "@/lib/supabase/server"
import { formatCentralTime } from "@/lib/time"
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
    exp?: string
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
  const { t, exp, error, done, at, test, email: emailParam, requested, request } =
    await searchParams
  const remembered = await getRememberedEmail()
  const email = emailParam?.trim().toLowerCase() || remembered
  const expiresAt = exp && /^\d+$/.test(exp) ? Number(exp) : null
  const supabase = await createClient()
  const rosterEligible = await hasRosterAddEligibility(sessionId)

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

  // Roster form only when the student explicitly chooses "request add"
  // (not on first not-on-roster failure — they retry check-in with guidance).
  const showRosterForm =
    done !== "1" &&
    requested !== "1" &&
    request === "add" &&
    (rosterEligible || error === "not_roster")

  const badEmailGuidance =
    error === "bad_email"
      ? "That email is not on this roster. Enter your Ole Miss student email ending in @go.olemiss.edu, then try again. You can reuse the classroom code already on this page even if the timer has expired."
      : undefined

  const checkInError =
    error === "expired"
      ? "Your roster request window expired. Enter the current classroom code to start again."
      : error === "ended"
        ? "This attendance session is no longer available. Ask your instructor to add you to the roster."
        : badEmailGuidance
          ? badEmailGuidance
          : error && error !== "not_roster" && error !== "bad_email"
            ? error
            : undefined

  const requestError =
    error === "missing" || request === "missing"
      ? "Enter last name, first name, network ID, student ID, and email."
      : error === "failed" || request === "failed"
        ? "Could not submit that request. Try again."
        : error === "enrolled"
          ? "That email is already on this roster. Checking you in…"
          : undefined

  return (
    <SiteChrome profile={null}>
      <div className="flex items-center justify-center px-4 py-16">
        <Card className="w-full max-w-[24rem]">
          <CardHeader>
            <CardTitle>
              {showRosterForm ? "Roster request" : "Check in"}
            </CardTitle>
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
                  {at ? ` at ${formatCentralTime(at)}.` : "."}
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
            ) : showRosterForm ? (
              <RosterAddRequestForm
                sessionId={sessionId}
                email={email}
                error={requestError}
                sessionEnded={info.ended}
              />
            ) : info.ended ? (
              <p role="alert" className="text-sm text-destructive">
                {error === "ended"
                  ? "This attendance session is no longer available. Ask your instructor to add you to the roster."
                  : "This session has ended."}
              </p>
            ) : (
              <CheckInForm
                sessionId={sessionId}
                email={email}
                token={t?.toUpperCase() ?? ""}
                expiresAt={expiresAt}
                error={checkInError}
                showRosterAddLink={error === "bad_email"}
                allowExpiredCode={error === "bad_email"}
                autoSubmit={
                  Boolean(remembered) &&
                  Boolean(t?.trim()) &&
                  !error &&
                  !info.ended
                }
              />
            )}
            <p className="text-center text-sm">
              <Link href="/student" className="underline-offset-4 hover:underline">
                Back to Student check-in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </SiteChrome>
  )
}
