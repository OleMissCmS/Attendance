import { hashEmail, normalizeEmail } from "@/lib/pii"
import {
  allowTestStudentCheckIn,
  isTestStudentEmail,
} from "@/lib/test-mode"

export const TEST_STUDENT_EMAIL = "test@test.com"

export function studentLookupHashes(query: string) {
  const trimmed = normalizeEmail(query)
  if (!trimmed) return [] as string[]
  const hashes = new Set<string>()
  if (trimmed.includes("@")) {
    hashes.add(hashEmail(trimmed))
  } else {
    hashes.add(hashEmail(`${trimmed}@go.olemiss.edu`))
    hashes.add(hashEmail(`${trimmed}@olemiss.edu`))
  }
  if (
    allowTestStudentCheckIn(TEST_STUDENT_EMAIL) &&
    (isTestStudentEmail(trimmed) || trimmed === "test")
  ) {
    hashes.add(hashEmail(TEST_STUDENT_EMAIL))
  }
  return [...hashes]
}

export function matchesStudentLookup(
  emailHash: string,
  lookupHashes: string[],
) {
  return lookupHashes.length === 0 || lookupHashes.includes(emailHash)
}

export function isPlaceholderValue(value: string) {
  const normalized = value.trim().toLowerCase()
  return (
    normalized === "term" ||
    normalized === "test" ||
    normalized === "section" ||
    normalized === "name" ||
    normalized === "code"
  )
}

export function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}
