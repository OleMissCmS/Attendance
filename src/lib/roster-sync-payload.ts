import { createHmac, timingSafeEqual } from "crypto"
import type { RosterDiffRow } from "@/lib/roster-diff"

type SyncPayload = {
  sectionId: number
  onlyInFile: RosterDiffRow[]
  onlyInPsoa: RosterDiffRow[]
  exp: number
}

function requireSecret() {
  const value = process.env.EMAIL_HMAC_SECRET
  if (!value) throw new Error("EMAIL_HMAC_SECRET is not configured.")
  return value
}

function sign(body: string) {
  return createHmac("sha256", requireSecret()).update(body).digest("base64url")
}

export function sealRosterSyncPayload(payload: Omit<SyncPayload, "exp">) {
  const full: SyncPayload = {
    ...payload,
    exp: Date.now() + 60 * 60 * 1000,
  }
  const body = Buffer.from(JSON.stringify(full), "utf8").toString("base64url")
  return `${body}.${sign(body)}`
}

export function openRosterSyncPayload(token: string): SyncPayload | null {
  const [body, mac] = token.split(".")
  if (!body || !mac) return null
  const expected = sign(body)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SyncPayload
    if (!parsed?.sectionId || !parsed.exp || parsed.exp < Date.now()) return null
    if (!Array.isArray(parsed.onlyInFile) || !Array.isArray(parsed.onlyInPsoa)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}
