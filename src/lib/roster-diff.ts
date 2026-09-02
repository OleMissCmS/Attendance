import type { RosterPerson } from "@/lib/blackboard-roster"
import { studentIdsMatch } from "@/lib/experience-export"

export type RosterDiffRow = {
  emailHash: string
  enrollmentId: number | null
  lastName: string
  firstName: string
  username: string
  studentId: string
  email: string
  name: string
}

export type RosterDiff = {
  /** On uploaded file, not on PSOA roster */
  onlyInFile: RosterDiffRow[]
  /** On PSOA roster, not in uploaded file */
  onlyInPsoa: RosterDiffRow[]
  /** On both — no change unless faculty opts otherwise */
  inBoth: RosterDiffRow[]
}

export type ExistingEnrollmentForDiff = {
  id: number
  email_hash: string
  lastName: string
  firstName: string
  username: string
  studentId: string
  email: string
  name: string
}

export function buildRosterDiff(
  existing: ExistingEnrollmentForDiff[],
  incoming: RosterPerson[],
  hashEmail: (email: string) => string,
): RosterDiff {
  const incomingRows = incoming.map((person) => ({
    person,
    emailHash: hashEmail(person.email),
  }))

  const existingByHash = new Map<string, ExistingEnrollmentForDiff>()
  for (const row of existing) {
    existingByHash.set(row.email_hash, row)
  }

  const matchedExistingIds = new Set<number>()
  const onlyInFile: RosterDiffRow[] = []
  const inBoth: RosterDiffRow[] = []
  const processedKeys = new Set<string>()

  for (const { person, emailHash } of incomingRows) {
    const dedupeKey = person.studentId
      ? `id:${person.studentId.toUpperCase()}`
      : `email:${emailHash}`
    if (processedKeys.has(dedupeKey)) continue
    processedKeys.add(dedupeKey)

    // 1. Try matching by email hash
    let matchedExisting = existingByHash.get(emailHash)

    // 2. If not matched by email hash, try matching by student ID (when both have ID)
    if (!matchedExisting && person.studentId) {
      matchedExisting = existing.find(
        (e) =>
          !matchedExistingIds.has(e.id) &&
          studentIdsMatch(e.studentId, person.studentId),
      )
    }

    // 3. If not matched, try matching by username (when both have username)
    if (!matchedExisting && person.username) {
      const u = person.username.toLowerCase()
      matchedExisting = existing.find(
        (e) =>
          !matchedExistingIds.has(e.id) &&
          e.username.toLowerCase() === u &&
          (!e.studentId || !person.studentId || studentIdsMatch(e.studentId, person.studentId)),
      )
    }

    if (matchedExisting) {
      matchedExistingIds.add(matchedExisting.id)
      inBoth.push({
        emailHash: matchedExisting.email_hash || emailHash,
        enrollmentId: matchedExisting.id,
        lastName: person.lastName || matchedExisting.lastName,
        firstName: person.firstName || matchedExisting.firstName,
        username: matchedExisting.username || person.username,
        studentId: person.studentId || matchedExisting.studentId,
        email: matchedExisting.email || person.email,
        name: person.name || matchedExisting.name,
      })
    } else {
      onlyInFile.push({
        emailHash,
        enrollmentId: null,
        lastName: person.lastName,
        firstName: person.firstName,
        username: person.username,
        studentId: person.studentId,
        email: person.email,
        name: person.name,
      })
    }
  }

  const onlyInPsoa: RosterDiffRow[] = []
  for (const row of existing) {
    if (matchedExistingIds.has(row.id)) continue
    onlyInPsoa.push({
      emailHash: row.email_hash,
      enrollmentId: row.id,
      lastName: row.lastName,
      firstName: row.firstName,
      username: row.username,
      studentId: row.studentId,
      email: row.email,
      name: row.name,
    })
  }

  const byName = (a: RosterDiffRow, b: RosterDiffRow) =>
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName) ||
    a.username.localeCompare(b.username)

  onlyInFile.sort(byName)
  onlyInPsoa.sort(byName)
  inBoth.sort(byName)

  return { onlyInFile, onlyInPsoa, inBoth }
}

export function displayRosterName(row: {
  lastName: string
  firstName: string
  name: string
  username: string
}) {
  if (row.lastName && row.firstName) return `${row.lastName}, ${row.firstName}`
  if (row.name) return row.name
  return row.username || "—"
}

/** Sort by Last, First (then username) so new adds appear in place, not at the bottom. */
export function compareRosterAlphabetically(
  a: { lastName: string; firstName: string; name: string; username: string },
  b: { lastName: string; firstName: string; name: string; username: string },
) {
  return (
    displayRosterName(a).localeCompare(displayRosterName(b), undefined, {
      sensitivity: "base",
    }) || a.username.localeCompare(b.username, undefined, { sensitivity: "base" })
  )
}
