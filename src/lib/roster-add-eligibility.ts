import { cookies } from "next/headers"

const COOKIE = "roster_add_session"
/** Long enough to finish the roster form; not tied to the 30s classroom code. */
const MAX_AGE_SECONDS = 60 * 60 * 4

export async function grantRosterAddEligibility(sessionId: string) {
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

export async function hasRosterAddEligibility(sessionId: string) {
  if (!sessionId) return false
  const store = await cookies()
  return store.get(COOKIE)?.value === sessionId
}

export async function clearRosterAddEligibility() {
  const store = await cookies()
  store.delete(COOKIE)
}
