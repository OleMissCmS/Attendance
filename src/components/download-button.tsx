"use client"

import { downloadCsv, downloadXlsx } from "@/lib/csv"

export function DownloadButton({
  filename,
  headers,
  rows,
  label,
  format = "csv",
  disabled = false,
  onNavy = false,
}: {
  filename: string
  headers: string[]
  rows: string[][]
  label: string
  format?: "csv" | "xlsx"
  disabled?: boolean
  onNavy?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      className={
        onNavy
          ? "inline-flex h-9 items-center rounded-md border border-white/50 bg-transparent px-4 text-sm font-medium text-white hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
          : "inline-flex h-9 items-center rounded-md border border-primary/20 bg-background px-4 text-sm font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
      }
      onClick={() => {
        if (format === "xlsx") {
          void downloadXlsx(filename, headers, rows)
          return
        }
        downloadCsv(filename, headers, rows)
      }}
    >
      {label}
    </button>
  )
}
