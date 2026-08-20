/** Campus / faculty-facing display timezone (US Central). */
export const APP_TIME_ZONE = "America/Chicago"

const centralDateTime: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
}

const centralDate: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
}

const centralTime: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
}

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function formatCentralDateTime(value: string | Date) {
  return asDate(value).toLocaleString("en-US", centralDateTime)
}

export function formatCentralDate(value: string | Date) {
  return asDate(value).toLocaleDateString("en-US", centralDate)
}

export function formatCentralTime(value: string | Date) {
  return asDate(value).toLocaleTimeString("en-US", centralTime)
}

/** Calendar YYYY-MM-DD in America/Chicago for date inputs / report filters. */
export function centralDateInput(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(asDate(value))
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

export function formatCentralMonthDay(value: string | Date) {
  return asDate(value).toLocaleDateString("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    day: "numeric",
  })
}
