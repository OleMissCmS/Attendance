import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto"

function requireKey(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is missing. Add it to .env.local.`)
  }
  return value
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function usernameFromEmail(email: string) {
  return normalizeEmail(email).split("@")[0] || ""
}

export function hashEmail(email: string) {
  return createHmac("sha256", requireKey("EMAIL_HMAC_SECRET"))
    .update(normalizeEmail(email))
    .digest("hex")
}

export function encryptPii(plaintext: string) {
  const key = Buffer.from(requireKey("PII_ENCRYPTION_KEY"), "base64")
  if (key.length !== 32) {
    throw new Error("PII_ENCRYPTION_KEY must be 32 bytes, base64-encoded.")
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decryptPii(payload: string | null | undefined) {
  if (!payload) return ""
  try {
    const key = Buffer.from(requireKey("PII_ENCRYPTION_KEY"), "base64")
    const buffer = Buffer.from(payload, "base64")
    const iv = buffer.subarray(0, 12)
    const tag = buffer.subarray(12, 28)
    const encrypted = buffer.subarray(28)
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return ""
  }
}

export function encryptOptionalPii(plaintext: string | null | undefined) {
  const value = plaintext?.trim() ?? ""
  return value ? encryptPii(value) : null
}

export type StudentIdentity = {
  lastName: string
  firstName: string
  username: string
  studentId: string
  email: string
  name: string
}

export function decryptEnrollment(row: {
  last_name_cipher?: string | null
  first_name_cipher?: string | null
  username_cipher?: string | null
  student_id_cipher?: string | null
  email_cipher?: string | null
  name_cipher?: string | null
}): StudentIdentity {
  const lastName = decryptPii(row.last_name_cipher)
  const firstName = decryptPii(row.first_name_cipher)
  const email = decryptPii(row.email_cipher)
  const username =
    usernameFromEmail(email) || decryptPii(row.username_cipher)
  const studentId = decryptPii(row.student_id_cipher)
  const name =
    decryptPii(row.name_cipher) ||
    `${firstName} ${lastName}`.replace(/\s+/g, " ").trim()
  return { lastName, firstName, username, studentId, email, name }
}
