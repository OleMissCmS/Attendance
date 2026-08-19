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

/** Local calendar date for `<input type="date">` / report `from`/`to` params. */
export function sessionLocalDateInput(startedAt: string) {
  const start = new Date(startedAt)
  const year = start.getFullYear()
  const month = String(start.getMonth() + 1).padStart(2, "0")
  const day = String(start.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function formatSessionTiming(startedAt: string, endedAt: string | null) {
  const start = new Date(startedAt)
  return {
    date: start.toLocaleDateString(),
    startTime: start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    }),
    stopTime: endedAt
      ? new Date(endedAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : "in progress",
    duration: formatDuration(startedAt, endedAt),
  }
}
