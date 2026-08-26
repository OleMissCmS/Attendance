import { downloadXlsx } from "@/lib/csv"

export const EXPERIENCE_MIDTERM_HEADERS = [
  "Term Code",
  "CRN",
  "Student ID",
  "Midterm Grade",
] as const

export type ExperienceRosterRow = {
  enrollmentId: number
  studentId: string
  lastName: string
  firstName: string
  username: string
  attended: number
}

export type ExperienceValidationIssue = {
  error: string
  termCode: string
  crn: string
  studentId: string
  midtermGrade: string
}

/** Normalize Banner-style student IDs (e.g. M12345678). */
export function normalizeStudentId(value: string) {
  return value.trim().toUpperCase()
}

/** Match keys so 020005727 and M020005727 can align when one side omits M. */
export function studentIdMatchKeys(value: string) {
  const normalized = normalizeStudentId(value)
  if (!normalized) return [] as string[]
  const keys = new Set<string>([normalized])
  if (normalized.startsWith("M") && /^\d+$/.test(normalized.slice(1))) {
    keys.add(normalized.slice(1))
  } else if (/^\d+$/.test(normalized)) {
    keys.add(`M${normalized}`)
  }
  return [...keys]
}

export function studentIdsMatch(a: string, b: string) {
  const aKeys = new Set(studentIdMatchKeys(a))
  return studentIdMatchKeys(b).some((key) => aKeys.has(key))
}

/**
 * Minimal Ellucian Faculty Grade Entry columns for midterm import.
 * Banner requires Term Code, CRN, and Student ID; Midterm Grade carries PR/NS.
 */
export function buildExperienceMidtermRows(options: {
  termCode: string
  crn: string
  sessionCount: number
  roster: ExperienceRosterRow[]
}): { headers: string[]; rows: string[][]; skippedNoId: number } {
  const termCode = options.termCode.trim()
  const crn = options.crn.trim()
  const rows: string[][] = []
  let skippedNoId = 0

  const sorted = [...options.roster].sort((a, b) =>
    normalizeStudentId(a.studentId).localeCompare(
      normalizeStudentId(b.studentId),
    ),
  )

  for (const person of sorted) {
    const studentId = normalizeStudentId(person.studentId)
    if (!studentId) {
      skippedNoId++
      continue
    }
    let grade = ""
    if (options.sessionCount > 0) {
      grade = person.attended >= 1 ? "PR" : "NS"
    }
    rows.push([termCode, crn, studentId, grade])
  }

  return {
    headers: [...EXPERIENCE_MIDTERM_HEADERS],
    rows,
    skippedNoId,
  }
}

export async function downloadExperienceMidtermXlsx(
  filename: string,
  options: {
    termCode: string
    crn: string
    sessionCount: number
    roster: ExperienceRosterRow[]
  },
) {
  const { headers, rows } = buildExperienceMidtermRows(options)
  await downloadXlsx(filename, headers, rows)
}

/** Parse Experience Faculty Grade Entry validation / import results workbook. */
export async function parseExperienceValidationReport(
  file: ArrayBuffer,
): Promise<ExperienceValidationIssue[]> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(file, { type: "array" })
  const sheetName =
    workbook.SheetNames.find((name) => /import\s*results/i.test(name)) ??
    workbook.SheetNames.find((name) => /validation/i.test(name)) ??
    workbook.SheetNames[0]
  if (!sheetName) throw new Error("The spreadsheet has no sheets.")

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    defval: "",
  }) as (string | number)[][]
  if (!rows.length) throw new Error("The spreadsheet is empty.")

  const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase())
  const errorCol = header.findIndex((h) => h === "error" || h === "errors")
  const studentIdCol = header.findIndex((h) => h === "student id")
  const termCol = header.findIndex((h) => h === "term code")
  const crnCol = header.findIndex((h) => h === "crn")
  const gradeCol = header.findIndex(
    (h) => h === "midterm grade" || h === "final grade",
  )
  if (errorCol < 0 || studentIdCol < 0) {
    throw new Error(
      'Expected columns "Error" and "Student ID" (Experience validation report).',
    )
  }

  const issues: ExperienceValidationIssue[] = []
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const error = String(row[errorCol] ?? "").trim()
    if (!error || /^no\s*errors\.?$/i.test(error)) continue
    issues.push({
      error,
      termCode: termCol >= 0 ? String(row[termCol] ?? "").trim() : "",
      crn: crnCol >= 0 ? String(row[crnCol] ?? "").trim() : "",
      studentId: String(row[studentIdCol] ?? "").trim(),
      midtermGrade: gradeCol >= 0 ? String(row[gradeCol] ?? "").trim() : "",
    })
  }
  return issues
}
