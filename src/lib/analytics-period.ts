/** Preset time windows for platform attendance usage analytics. */
export const ANALYTICS_PERIODS = ["week", "month", "year", "semester"] as const

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number]

export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = "month"

export const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  week: "Last week",
  month: "Last month",
  year: "Last year",
  semester: "Current semester",
}

export function parseAnalyticsPeriod(
  value: string | undefined | null,
): AnalyticsPeriod {
  if (
    value === "week" ||
    value === "month" ||
    value === "year" ||
    value === "semester"
  ) {
    return value
  }
  return DEFAULT_ANALYTICS_PERIOD
}

/** Short chart/KPI suffix, e.g. "30d" or "current semester". */
export function periodRangeHint(period: AnalyticsPeriod): string {
  switch (period) {
    case "week":
      return "7d"
    case "month":
      return "30d"
    case "year":
      return "365d"
    case "semester":
      return "current semester"
  }
}
