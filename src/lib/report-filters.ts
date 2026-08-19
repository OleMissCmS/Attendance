export const REPORT_FILTER_KEYS = [
  "course",
  "section",
  "session",
  "from",
  "to",
  "student",
  "flags",
  "streak",
] as const

export type ReportFilterKey = (typeof REPORT_FILTER_KEYS)[number]

function normalizeReportFilter(key: ReportFilterKey, value: string) {
  const trimmed = value.trim()
  if (key === "flags" && !trimmed) return "all"
  if (key === "streak" && !trimmed) return "3"
  return trimmed
}

export function buildReportQuery(
  values: Partial<Record<ReportFilterKey, string | null | undefined>>,
) {
  const params = new URLSearchParams()
  for (const key of REPORT_FILTER_KEYS) {
    const value = normalizeReportFilter(key, String(values[key] ?? ""))
    if (!value) continue
    if (key === "flags" && value === "all") continue
    if (key === "streak" && value === "3") continue
    params.set(key, value)
  }
  return params.toString()
}
