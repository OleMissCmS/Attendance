"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateDeviceId, rememberEmail } from "@/lib/device"
import {
  encryptOptionalPii,
  encryptPii,
  hashEmail,
  normalizeEmail,
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

  const { error } = await supabase.rpc("check_in", {
    p_session_id: sessionId,
    p_token: token,
    p_email_hash: hashEmail(email),
    p_email_cipher: encryptPii(email),
    p_device_id: deviceId,
    p_is_incognito: isIncognito,
    p_is_test: allowTestStudentCheckIn(email),
  })

  if (error) {
    const params = new URLSearchParams()
    if (token) params.set("t", token)
    if (/not on this roster/i.test(error.message)) {
      params.set("error", "not_roster")
      if (email) params.set("email", email)
    } else {
      params.set("error", error.message)
    }
    redirect(`/c/${sessionId}?${params.toString()}`)
  }

  await rememberEmail(email)
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

  const fail = (code: string) => {
    const params = new URLSearchParams({ error: "not_roster", request: code })
    if (email) params.set("email", email)
    redirect(`/c/${sessionId}?${params.toString()}`)
  }

  if (!sessionId) fail("missing")
  if (!lastName || !firstName || !networkId || !studentId || !email.includes("@")) {
    fail("missing")
  }

  const fullName = `${lastName}, ${firstName}`
  const { error } = await supabase.rpc("request_roster_addition", {
    p_session_id: sessionId,
    p_email_hash: hashEmail(email),
    p_email_cipher: encryptPii(email),
    p_last_name_cipher: encryptPii(lastName),
    p_first_name_cipher: encryptPii(firstName),
    p_username_cipher: encryptPii(networkId || usernameFromEmail(email)),
    p_student_id_cipher: encryptPii(studentId),
    p_name_cipher: encryptOptionalPii(fullName) ?? encryptPii(fullName),
  })
  if (error) fail("failed")

  await rememberEmail(email)
  redirect(`/c/${sessionId}?requested=1`)
}

export async function saveStudentEmail(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email.includes("@")) redirect("/student?error=email")
  await rememberEmail(email)
  redirect("/student")
}
