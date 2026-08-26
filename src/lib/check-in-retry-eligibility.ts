import { cookies } from "next/headers"

const COOKIE = "check_in_retry_session"
/** Long enough to fix a typo’d email without needing a fresh rotating code. */
const MAX_AGE_SECONDS = 60 * 30

export async function grantCheckInRetryEligibility(sessionId: string) {
  if (!sessionId) return
  const store = await cookies()
  store.set(COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function hasCheckInRetryEligibility(sessionId: string) {
  if (!sessionId) return false
  const store = await cookies()
  return store.get(COOKIE)?.value === sessionId
}

export async function clearCheckInRetryEligibility() {
  const store = await cookies()
  store.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
