const EMAIL_DOMAIN = "go.olemiss.edu"

const SKIP_USERNAMES = new Set([
  "username",
  "user name",
  "points possible",
  "total",
  "weighted total",
])

const SKIP_LAST_NAMES = new Set(["points possible", "last name"])

export type RosterPerson = {
  lastName: string
  firstName: string
  username: string
  studentId: string
  email: string
  name: string
}

function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (!quoted && (char === "\t" || char === ",")) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells.map((cell) => cell.replace(/^"+|"+$/g, "").trim())
}

function headerIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) =>
    aliases.some((alias) => header.toLowerCase() === alias),
  )
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/@.*$/, "")
}

export function parseBlackboardRoster(text: string): RosterPerson[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\uFEFF/, "").trim())
    .filter(Boolean)
  if (lines.length < 2) return []

  const headerLineIdx = lines.findIndex((line) => {
    const headers = splitRow(line).map((header) => header.toLowerCase())
    return headerIndex(headers, ["username", "user name", "user id"]) >= 0
  })
  if (headerLineIdx < 0 || headerLineIdx >= lines.length - 1) return []

  const headers = splitRow(lines[headerLineIdx]).map((header) =>
    header.toLowerCase(),
  )
  const lastIdx = headerIndex(headers, ["last name", "lastname"])
  const firstIdx = headerIndex(headers, ["first name", "firstname"])
  const userIdx = headerIndex(headers, ["username", "user name", "user id"])
  const idIdx = headerIndex(headers, [
    "student id",
    "studentid",
    "student_id",
  ])

  if (userIdx < 0) return []

  const people: RosterPerson[] = []
  const seen = new Set<string>()

  for (const line of lines.slice(headerLineIdx + 1)) {
    const cells = splitRow(line)
    const username = normalizeUsername(cells[userIdx] ?? "")
    const lastName = lastIdx >= 0 ? (cells[lastIdx] ?? "").trim() : ""
    const firstName = firstIdx >= 0 ? (cells[firstIdx] ?? "").trim() : ""
    if (!username || SKIP_USERNAMES.has(username)) continue
    if (SKIP_LAST_NAMES.has(lastName.toLowerCase())) continue

    const studentId = (idIdx >= 0 ? cells[idIdx] ?? "" : "")
      .replace(/\.0$/, "")
      .trim()
    const name = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim()
    const email = `${username}@${EMAIL_DOMAIN}`
    if (seen.has(email)) continue
    seen.add(email)
    people.push({
      lastName,
      firstName,
      username,
      studentId,
      email,
      name,
    })
  }

  return people
}

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

function rowsToTsv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => String(cell ?? "").trim())
        .join("\t"),
    )
    .join("\n")
}

export async function parseRosterFile(file: File): Promise<RosterPerson[]> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const asText = bufferToText(buffer)
  const looksText =
    /username/i.test(asText) ||
    /last name/i.test(asText) ||
    asText.includes("<table")

  if (looksText) {
    const text = asText.includes("<table")
      ? asText.replace(/<[^>]+>/g, "\t")
      : asText
    const parsed = parseBlackboardRoster(text)
    if (parsed.length) return parsed
  }

  const XLSX = await import("xlsx")
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(
    sheet,
    {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    },
  )
  return parseBlackboardRoster(rowsToTsv(matrix))
}
