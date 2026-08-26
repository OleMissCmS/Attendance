import { cookies } from "next/headers"

const DEVICE_COOKIE = "attendance_device"
const EMAIL_COOKIE = "attendance_student_email"

export async function getOrCreateDeviceId() {
  const store = await cookies()
  const existing = store.get(DEVICE_COOKIE)?.value
  if (existing) return existing

  const deviceId = crypto.randomUUID()
  store.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  })
  return deviceId
}

export async function getRememberedEmail() {
  const store = await cookies()
  return store.get(EMAIL_COOKIE)?.value ?? ""
}

export async function rememberEmail(email: string) {
  const store = await cookies()
  store.set(EMAIL_COOKIE, email.toLowerCase().trim(), {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
  })
}

/** Clear remembered student email (e.g. after a failed check-in with a bad address). */
export async function clearRememberedEmail() {
  const store = await cookies()
  store.delete(EMAIL_COOKIE)
}
