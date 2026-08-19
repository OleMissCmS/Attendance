function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const csv =
    "\uFEFF" +
    [headers, ...rows]
      .map((row) => row.map((cell) => escapeCsv(cell ?? "")).join(","))
      .join("\r\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function downloadXlsx(
  filename: string,
  headers: string[],
  rows: string[][],
) {
  const XLSX = await import("xlsx")
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, "Grades")
  XLSX.writeFile(workbook, filename)
}
