"use server"

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateDeviceId, rememberEmail } from "@/lib/device"
import { encryptPii, hashEmail, normalizeEmail } from "@/lib/pii"
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
    params.set("error", error.message)
    redirect(`/c/${sessionId}?${params.toString()}`)
  }

  await rememberEmail(email)
  const params = new URLSearchParams({ done: "1", at: new Date().toISOString() })
  if (allowTestStudentCheckIn(email)) params.set("test", "1")
  redirect(`/c/${sessionId}?${params.toString()}`)
}

export async function saveStudentEmail(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""))
  if (!email.includes("@")) redirect("/student?error=email")
  await rememberEmail(email)
  redirect("/student")
}
