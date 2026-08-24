"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateDeviceId, rememberEmail } from "@/lib/device"
import {
  clearRosterAddEligibility,
  grantRosterAddEligibility,
  hasRosterAddEligibility,
} from "@/lib/roster-add-eligibility"
import {
  encryptOptionalPii,
  encryptPii,
  normalizeEmail,
  preferredStudentEmail,
  rosterEmailHashes,
  usernameFromEmail,
} from "@/lib/pii"
import { collapseWhitespace } from "@/lib/student-identity"
import { allowTestStudentCheckIn } from "@/lib/test-mode"

export async function submitCheckIn(formData: FormData) {
  const supabase = await createClient()
  const sessionId = String(formData.get("session_id") ?? "")
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const token = String(formData.get("token") ?? "")
    .trim()
    .toUpperCase()
  const isIncognito = String(formData.get("incognito") ?? "") === "1"
  const deviceId = await getOrCreateDeviceId()
  const { primary, alts } = rosterEmailHashes(email)

  const { data, error } = await supabase.rpc("check_in", {
    p_session_id: sessionId,
    p_token: token,
    p_email_hash: primary,
    p_email_cipher: encryptPii(email),
    p_device_id: deviceId,
    p_is_incognito: isIncognito,
    p_is_test: allowTestStudentCheckIn(email),
    p_alt_email_hashes: alts.length ? alts : undefined,
  })

  const result = data as {
    ok?: boolean
    error?: string
    email_aliased?: boolean
  } | null
  const failedMessage =
    error?.message ||
    (result && result.ok === false ? result.error || "Check-in failed" : null)

  if (failedMessage) {
    // Re-scan after a successful check-in: show confirmation instead of an error.
    if (/already checked in/i.test(failedMessage)) {
      await clearRosterAddEligibility()
      await rememberEmail(
        result?.email_aliased ? preferredStudentEmail(email) : email,
      )
      const alreadyParams = new URLSearchParams({
        done: "1",
        at: new Date().toISOString(),
      })
      if (allowTestStudentCheckIn(email)) alreadyParams.set("test", "1")
      redirect(`/c/${sessionId}?${alreadyParams.toString()}`)
    }

    const params = new URLSearchParams()
    if (/not on this roster/i.test(failedMessage)) {
      // Presence already proved via a valid classroom code; do not keep `t=`
      // (expired codes) on the URL or re-bind this flow to the 30s window.
      await grantRosterAddEligibility(sessionId)
      params.set("error", "not_roster")
      if (email) params.set("email", email)
    } else {
      if (token) params.set("t", token)
      params.set("error", failedMessage)
    }
    redirect(`/c/${sessionId}?${params.toString()}`)
  }

  await clearRosterAddEligibility()
  await rememberEmail(
    result?.email_aliased ? preferredStudentEmail(email) : email,
  )
  const params = new URLSearchParams({ done: "1", at: new Date().toISOString() })
  if (allowTestStudentCheckIn(email)) params.set("test", "1")
  redirect(`/c/${sessionId}?${params.toString()}`)
}

export async function requestRosterAddition(formData: FormData) {
  const supabase = await createClient()
  const sessionId = String(formData.get("session_id") ?? "")
  const lastName = collapseWhitespace(String(formData.get("last_name") ?? ""))
  const firstName = collapseWhitespace(String(formData.get("first_name") ?? ""))
  const networkId = collapseWhitespace(String(formData.get("network_id") ?? ""))
  const studentId = collapseWhitespace(String(formData.get("student_id") ?? ""))
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const checkInEmail = normalizeEmail(
    String(formData.get("check_in_email") ?? email),
  )

  const fail = async (code: string) => {
    // Eligibility lost or session gone: return to check-in, not the roster form.
    if (code === "expired" || code === "ended") {
      await clearRosterAddEligibility()
      const params = new URLSearchParams({ error: code })
      if (email) params.set("email", email)
      redirect(`/c/${sessionId}?${params.toString()}`)
    }
    const params = new URLSearchParams({ error: "not_roster", request: code })
    if (email) params.set("email", email)
    redirect(`/c/${sessionId}?${params.toString()}`)
  }

  if (!sessionId) await fail("missing")
  if (!(await hasRosterAddEligibility(sessionId))) await fail("expired")
  if (!lastName || !firstName || !networkId || !studentId || !email.includes("@")) {
    await fail("missing")
  }

  const { primary, alts } = rosterEmailHashes(email)
  const checkInHashes = rosterEmailHashes(checkInEmail)
  const fullName = `${lastName}, ${firstName}`
  const { error } = await supabase.rpc("request_roster_addition", {
    p_session_id: sessionId,
    p_email_hash: primary,
    p_email_cipher: encryptPii(email),
    p_last_name_cipher: encryptPii(lastName),
    p_first_name_cipher: encryptPii(firstName),
    p_username_cipher: encryptPii(networkId || usernameFromEmail(email)),
    p_student_id_cipher: encryptPii(studentId),
    p_name_cipher: encryptOptionalPii(fullName) ?? encryptPii(fullName),
    p_alt_email_hashes: alts.length ? alts : undefined,
    p_check_in_email_hash: checkInHashes.primary,
    p_check_in_email_cipher: encryptPii(checkInEmail),
  })
  if (error) {
    if (/session has ended/i.test(error.message)) await fail("ended")
    if (/session not found|no live session/i.test(error.message)) await fail("ended")
    if (/already on this roster/i.test(error.message)) await fail("enrolled")
    await fail("failed")
  }

  await clearRosterAddEligibility()
  await rememberEmail(email)
  redirect(`/c/${sessionId}?requested=1`)
}

export async function saveStudentEmail(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email.includes("@")) redirect("/student?error=email")
  await rememberEmail(email)
  redirect("/student?saved=1")
}
