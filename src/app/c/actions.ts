"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  clearRememberedEmail,
  getOrCreateDeviceId,
  rememberEmail,
} from "@/lib/device"
import {
  clearCheckInRetryEligibility,
  grantCheckInRetryEligibility,
  hasCheckInRetryEligibility,
} from "@/lib/check-in-retry-eligibility"
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

async function logMiss(args: {
  sessionId: string
  email: string
  deviceId: string
  source: "check_in" | "roster_add_enrolled"
}) {
  const { primary } = rosterEmailHashes(args.email)
  const supabase = await createClient()
  await supabase.rpc("log_roster_miss_attempt", {
    p_session_id: args.sessionId,
    p_email_hash: primary,
    p_email_cipher: encryptPii(args.email),
    p_device_id: args.deviceId,
    p_source: args.source,
  })
}

async function completeCheckIn(args: {
  sessionId: string
  email: string
  emailAliased?: boolean
  test?: boolean
}) {
  await clearRosterAddEligibility()
  await clearCheckInRetryEligibility()
  await rememberEmail(
    args.emailAliased ? preferredStudentEmail(args.email) : args.email,
  )
  const params = new URLSearchParams({
    done: "1",
    at: new Date().toISOString(),
  })
  if (args.test) params.set("test", "1")
  redirect(`/c/${args.sessionId}?${params.toString()}`)
}

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
  const emailCipher = encryptPii(email)
  const canRetryWithoutCode = await hasCheckInRetryEligibility(sessionId)

  let data: unknown = null
  let error: { message: string } | null = null

  if (canRetryWithoutCode && (!token || token.length < 6)) {
    const rostered = await supabase.rpc("check_in_rostered", {
      p_session_id: sessionId,
      p_email_hash: primary,
      p_email_cipher: emailCipher,
      p_device_id: deviceId,
      p_is_incognito: isIncognito,
      p_alt_email_hashes: alts.length ? alts : undefined,
    })
    data = rostered.data
    error = rostered.error
  } else {
    const normal = await supabase.rpc("check_in", {
      p_session_id: sessionId,
      p_token: token,
      p_email_hash: primary,
      p_email_cipher: emailCipher,
      p_device_id: deviceId,
      p_is_incognito: isIncognito,
      p_is_test: allowTestStudentCheckIn(email),
      p_alt_email_hashes: alts.length ? alts : undefined,
    })
    data = normal.data
    error = normal.error

    const failedEarly =
      error?.message ||
      (data &&
      typeof data === "object" &&
      (data as { ok?: boolean }).ok === false
        ? (data as { error?: string }).error || "Check-in failed"
        : null)

    // After a not-on-roster miss, allow the same session without a live code
    // once the student fixes their email (rotating code may have expired).
    if (
      failedEarly &&
      /code expired or incorrect/i.test(failedEarly) &&
      canRetryWithoutCode
    ) {
      const rostered = await supabase.rpc("check_in_rostered", {
        p_session_id: sessionId,
        p_email_hash: primary,
        p_email_cipher: emailCipher,
        p_device_id: deviceId,
        p_is_incognito: isIncognito,
        p_alt_email_hashes: alts.length ? alts : undefined,
      })
      data = rostered.data
      error = rostered.error
    }
  }

  const result = data as {
    ok?: boolean
    error?: string
    email_aliased?: boolean
  } | null
  const failedMessage =
    error?.message ||
    (result && result.ok === false ? result.error || "Check-in failed" : null)

  if (failedMessage) {
    if (/already checked in/i.test(failedMessage)) {
      await completeCheckIn({
        sessionId,
        email,
        emailAliased: result?.email_aliased,
        test: allowTestStudentCheckIn(email),
      })
    }

    const params = new URLSearchParams()
    if (/not on this roster/i.test(failedMessage)) {
      await logMiss({
        sessionId,
        email,
        deviceId,
        source: "check_in",
      })
      await clearRememberedEmail()
      // They proved they had a live code once; let them retry this session
      // after fixing email without needing a fresh rotating code.
      await grantCheckInRetryEligibility(sessionId)
      if (token) params.set("t", token)
      params.set("error", "bad_email")
      // Do not prefills the bad address — force a fresh email entry.
    } else {
      if (token) params.set("t", token)
      params.set("error", failedMessage)
      if (email) params.set("email", email)
    }
    redirect(`/c/${sessionId}?${params.toString()}`)
  }

  await completeCheckIn({
    sessionId,
    email,
    emailAliased: result?.email_aliased,
    test: allowTestStudentCheckIn(email),
  })
}

export async function startRosterAddRequest(formData: FormData) {
  const sessionId = String(formData.get("session_id") ?? "")
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  const token = String(formData.get("token") ?? "")
    .trim()
    .toUpperCase()
  if (!sessionId) redirect("/student")
  await grantRosterAddEligibility(sessionId)
  const params = new URLSearchParams({ request: "add" })
  if (email) params.set("email", email)
  if (token) params.set("t", token)
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
  const deviceId = await getOrCreateDeviceId()

  const fail = async (code: string) => {
    if (code === "expired" || code === "ended") {
      await clearRosterAddEligibility()
      const params = new URLSearchParams({ error: code })
      if (email) params.set("email", email)
      redirect(`/c/${sessionId}?${params.toString()}`)
    }
    const params = new URLSearchParams({ request: "add", error: code })
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
    if (/already on this roster/i.test(error.message)) {
      // Email is on the roster — check them in without requiring a live code.
      const isIncognito = String(formData.get("incognito") ?? "") === "1"
      const { data, error: checkInError } = await supabase.rpc(
        "check_in_rostered",
        {
          p_session_id: sessionId,
          p_email_hash: primary,
          p_email_cipher: encryptPii(email),
          p_device_id: deviceId,
          p_is_incognito: isIncognito,
          p_alt_email_hashes: alts.length ? alts : undefined,
        },
      )
      if (checkInError) {
        await logMiss({
          sessionId,
          email,
          deviceId,
          source: "roster_add_enrolled",
        })
        await fail("failed")
      }
      const payload = data as { email_aliased?: boolean } | null
      await completeCheckIn({
        sessionId,
        email,
        emailAliased: payload?.email_aliased,
        test: allowTestStudentCheckIn(email),
      })
    }
    await fail("failed")
  }

  await clearRosterAddEligibility()
  // Do not bind until faculty accepts and they successfully check in.
  redirect(`/c/${sessionId}?requested=1`)
}

export async function saveStudentEmail(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email.includes("@")) redirect("/student?error=email")
  // Remembering for convenience is OK; device_identities bind only on successful check-in.
  await rememberEmail(email)
  redirect("/student?saved=1")
}
