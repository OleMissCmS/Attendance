import {
  centralDateInput,
  formatCentralDate,
  formatCentralTime,
} from "@/lib/time"

export function formatDuration(startedAt: string, endedAt: string | null) {
  if (!endedAt) return "in progress"
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 0) return "—"
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes} min`
  return `${hours}h ${minutes}m`
}

/** America/Chicago calendar date for `<input type="date">` / report `from`/`to` params. */
export function sessionLocalDateInput(startedAt: string) {
  return centralDateInput(startedAt)
}

export function formatSessionTiming(startedAt: string, endedAt: string | null) {
  return {
    date: formatCentralDate(startedAt),
    startTime: formatCentralTime(startedAt),
    stopTime: endedAt ? formatCentralTime(endedAt) : "in progress",
    duration: formatDuration(startedAt, endedAt),
  }
}
