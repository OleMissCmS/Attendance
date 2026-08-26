import type { RosterPerson } from "@/lib/blackboard-roster"

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
  /** On Blackboard file, not on PSOA roster */
  onlyInFile: RosterDiffRow[]
  /** On PSOA roster, not in Blackboard file */
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
  const byHash = new Map<string, RosterPerson>()
  for (const person of incoming) {
    const emailHash = hashEmail(person.email)
    if (byHash.has(emailHash)) continue
    byHash.set(emailHash, person)
  }

  const existingByHash = new Map(
    existing.map((row) => [row.email_hash, row] as const),
  )

  const onlyInFile: RosterDiffRow[] = []
  const onlyInPsoa: RosterDiffRow[] = []
  const inBoth: RosterDiffRow[] = []

  for (const [emailHash, person] of byHash) {
    const current = existingByHash.get(emailHash)
    const row: RosterDiffRow = {
      emailHash,
      enrollmentId: current?.id ?? null,
      lastName: person.lastName,
      firstName: person.firstName,
      username: person.username,
      studentId: person.studentId,
      email: person.email,
      name: person.name,
    }
    if (current) inBoth.push(row)
    else onlyInFile.push(row)
  }

  for (const row of existing) {
    if (byHash.has(row.email_hash)) continue
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
