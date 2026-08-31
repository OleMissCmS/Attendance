import { normalizeEmail, preferredStudentEmail } from "@/lib/pii"

const EMAIL_DOMAIN = "go.olemiss.edu"

const USERNAME_ALIASES = [
  "username",
  "user name",
  "user id",
  "userid",
  "network id",
  "networkid",
  "webid",
  "web id",
]

const EMAIL_ALIASES = [
  "student email address",
  "student email",
  "student_email",
  "email address",
  "email",
  "e-mail",
  "e-mail address",
  "mail",
  "primary email",
  "ole miss email",
]

const LAST_NAME_ALIASES = [
  "last name",
  "lastname",
  "student last name",
  "last",
  "surname",
]

const FIRST_NAME_ALIASES = [
  "first name",
  "firstname",
  "student first name",
  "first",
  "given name",
  "preferred name",
  "preferred first name",
]

const FULL_NAME_ALIASES = [
  "student name",
  "student_name",
  "name",
  "full name",
  "fullname",
  "student",
]

const STUDENT_ID_ALIASES = [
  "student id",
  "studentid",
  "student_id",
  "student number",
  "student number (id)",
  "banner id",
  "id",
  "id number",
  "emplid",
  "student identification",
]

const STATUS_ALIASES = [
  "registration status",
  "reg status",
  "status",
  "enrollment status",
]

const SKIP_VALUES = new Set([
  "username",
  "user name",
  "user id",
  "points possible",
  "total",
  "weighted total",
  "last name",
  "student last name",
  "student name",
  "id",
  "student id",
  "course information",
  "enrollment counts",
  "summary class list",
  "course title",
  "crn",
  "duration",
  "maximum",
  "actual",
  "remaining",
])

export type RosterPerson = {
  lastName: string
  firstName: string
  username: string
  studentId: string
  email: string
  name: string
}

function normalizeHeader(s: string) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
}

function headerIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) =>
    aliases.includes(normalizeHeader(header)),
  )
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/@.*$/, "")
}

function isRosterHeader(headers: string[]) {
  const normHeaders = headers.map(normalizeHeader)
  const hasUser = headerIndex(normHeaders, USERNAME_ALIASES) >= 0
  const hasEmail = headerIndex(normHeaders, EMAIL_ALIASES) >= 0
  const hasLast = headerIndex(normHeaders, LAST_NAME_ALIASES) >= 0
  const hasFirst = headerIndex(normHeaders, FIRST_NAME_ALIASES) >= 0
  const hasFullName = headerIndex(normHeaders, FULL_NAME_ALIASES) >= 0
  const hasId = headerIndex(normHeaders, STUDENT_ID_ALIASES) >= 0

  if (hasUser || hasEmail) return true
  if ((hasFullName || hasLast) && hasId) return true
  if (hasLast && hasFirst) return true
  return false
}

function parseName(rawName: string): {
  firstName: string
  lastName: string
  name: string
} {
  const trimmed = String(rawName || "").trim()
  if (!trimmed) return { firstName: "", lastName: "", name: "" }
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",")
    const lastName = parts[0].trim()
    const firstName = parts.slice(1).join(",").trim()
    const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim()
    return { firstName, lastName, name }
  }
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0], name: parts[0] }
  }
  const firstName = parts[0]
  const lastName = parts.slice(1).join(" ")
  return { firstName, lastName, name: trimmed }
}

function isDroppedStatus(status: string) {
  const s = String(status || "").trim().toLowerCase()
  return (
    /\b(drop|dropped|withdrawn|withdraw|cancelled|canceled|deleted|wc|dd|dw)\b/i.test(
      s,
    ) || /\b(drop|withdraw|cancel|delete)/i.test(s)
  )
}

function splitRow(line: string): string[] {
  const isTsv = line.includes("\t")
  if (isTsv) {
    return line.split("\t").map((cell) => cell.replace(/^"+|"+$/g, "").trim())
  }

  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && char === ",") {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells.map((cell) => cell.replace(/^"+|"+$/g, "").trim())
}

export function parseRosterMatrix(matrix: unknown[][]): RosterPerson[] {
  const rows = matrix.map((r) =>
    Array.isArray(r) ? r.map((c) => String(c ?? "").trim()) : [],
  )
  const headerLineIdx = rows.findIndex((r) => isRosterHeader(r))
  if (headerLineIdx < 0 || headerLineIdx >= rows.length - 1) return []

  const headers = rows[headerLineIdx]
  const lastIdx = headerIndex(headers, LAST_NAME_ALIASES)
  const firstIdx = headerIndex(headers, FIRST_NAME_ALIASES)
  const fullIdx = headerIndex(headers, FULL_NAME_ALIASES)
  const userIdx = headerIndex(headers, USERNAME_ALIASES)
  const emailIdx = headerIndex(headers, EMAIL_ALIASES)
  const idIdx = headerIndex(headers, STUDENT_ID_ALIASES)
  const statusIdx = headerIndex(headers, STATUS_ALIASES)

  const people: RosterPerson[] = []
  const seen = new Set<string>()

  for (const cells of rows.slice(headerLineIdx + 1)) {
    if (!cells.some((c) => c)) continue

    if (statusIdx >= 0 && isDroppedStatus(cells[statusIdx] ?? "")) {
      continue
    }

    let lastName = lastIdx >= 0 ? (cells[lastIdx] ?? "").trim() : ""
    let firstName = firstIdx >= 0 ? (cells[firstIdx] ?? "").trim() : ""
    let name = ""

    if ((!lastName || !firstName) && fullIdx >= 0 && cells[fullIdx]) {
      const parsed = parseName(cells[fullIdx])
      if (!lastName) lastName = parsed.lastName
      if (!firstName) firstName = parsed.firstName
      name = parsed.name
    } else {
      name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim()
    }

    const rawId = idIdx >= 0 ? (cells[idIdx] ?? "").replace(/\.0$/, "").trim() : ""
    const studentId = rawId

    const fromUsername =
      userIdx >= 0 ? normalizeUsername(cells[userIdx] ?? "") : ""
    const fromEmail =
      emailIdx >= 0 ? normalizeUsername(cells[emailIdx] ?? "") : ""
    const rawEmail = emailIdx >= 0 ? (cells[emailIdx] ?? "").trim() : ""

    let username = fromUsername || fromEmail
    if (!username && studentId) {
      username = studentId.toLowerCase()
    }

    if (!username || SKIP_VALUES.has(username) || SKIP_VALUES.has(normalizeHeader(lastName))) {
      continue
    }

    let email = ""
    if (rawEmail && rawEmail.includes("@")) {
      email = preferredStudentEmail(rawEmail)
    } else {
      email = `${username}@${EMAIL_DOMAIN}`
    }

    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    people.push({
      lastName,
      firstName,
      username,
      studentId,
      email,
      name: name || `${firstName} ${lastName}`.trim() || username,
    })
  }

  return people
}

function htmlToTsv(html: string): string {
  return html
    .replace(/<\/tr>/gi, "\n")
    .replace(/<tr[^>]*>/gi, "")
    .replace(/<\/(?:td|th)>/gi, "\t")
    .replace(/<[^>]+>/g, "")
}

export function parseBlackboardRoster(text: string): RosterPerson[] {
  const cleanText =
    text.includes("<table") || /<(?:tr|th|td)[\s>]/i.test(text)
      ? htmlToTsv(text)
      : text
  const lines = cleanText
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, "").trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const matrix = lines.map((line) => splitRow(line))
  return parseRosterMatrix(matrix)
}

export const parseRosterText = parseBlackboardRoster

export function bufferToText(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le")
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const swapped = Buffer.from(buffer.subarray(2))
    for (let i = 0; i + 1 < swapped.length; i += 2) {
      const a = swapped[i]
      swapped[i] = swapped[i + 1]
      swapped[i + 1] = a
    }
    return swapped.toString("utf16le")
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return buffer.subarray(3).toString("utf8")
  }
  // UTF-16 LE without BOM: many nulls on odd bytes
  if (buffer.length >= 8) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 64))
    let nullOdds = 0
    for (let i = 1; i < sample.length; i += 2) {
      if (sample[i] === 0) nullOdds += 1
    }
    if (nullOdds >= sample.length / 4) {
      return buffer.toString("utf16le")
    }
  }
  return buffer.toString("utf8")
}

export async function parseRosterFile(file: File): Promise<RosterPerson[]> {
  const buffer = Buffer.from(await file.arrayBuffer())

  const isZip =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  const isOldExcel =
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0

  if (isZip || isOldExcel || /\.(xlsx|xls)$/i.test(file.name)) {
    const XLSX = await import("xlsx")
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
    const targetSheetNames = [
      ...workbook.SheetNames.filter((s) => /class\s*list/i.test(s)),
      ...workbook.SheetNames.filter((s) => !/class\s*list/i.test(s)),
    ]

    for (const sheetName of targetSheetNames) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue
      const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
        sheet,
        {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        },
      )
      const parsed = parseRosterMatrix(matrix)
      if (parsed.length) return parsed
    }
  }

  const asText = bufferToText(buffer)
  return parseBlackboardRoster(asText)
}
