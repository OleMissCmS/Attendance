"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { saveSectionBannerIds } from "@/app/faculty/actions"
import { downloadExperienceMidtermXlsx } from "@/lib/experience-export"
import type { ExperienceRosterRow } from "@/lib/experience-export"

export function ExperienceReportingPanel({
  sectionId,
  courseLabel,
  sectionLabel,
  initialCrn,
  initialTermCode,
  sessionCount,
  roster,
}: {
  sectionId: number
  courseLabel: string
  sectionLabel: string
  initialCrn: string
  initialTermCode: string
  sessionCount: number
  roster: ExperienceRosterRow[]
}) {
  const router = useRouter()
  const [crn, setCrn] = useState(initialCrn)
  const [termCode, setTermCode] = useState(initialTermCode)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setCrn(initialCrn)
    setTermCode(initialTermCode)
  }, [initialCrn, initialTermCode, sectionId])

  function onDownload() {
    setError(null)
    setMessage(null)
    const trimmedCrn = crn.trim()
    const trimmedTerm = termCode.trim()
    if (!trimmedCrn || !trimmedTerm) {
      setError("Enter both Term Code and CRN before downloading.")
      return
    }
    if (sessionCount <= 0) {
      setError("No sessions in the current date range to score attendance.")
      return
    }
    const withIds = roster.filter((row) => row.studentId.trim())
    if (!withIds.length) {
      setError("No roster students have a Student ID to match in Experience.")
      return
    }

    startTransition(async () => {
      const formData = new FormData()
      formData.set("section_id", String(sectionId))
      formData.set("banner_crn", trimmedCrn)
      formData.set("banner_term_code", trimmedTerm)
      const result = await saveSectionBannerIds(formData)
      if (result.error) {
        setError(result.error)
        return
      }

      const safe = (value: string) => value.replace(/\s+/g, "_")
      const filename = `${safe(trimmedTerm)}_${safe(trimmedCrn)}_midterm_experience.xlsx`
      await downloadExperienceMidtermXlsx(filename, {
        termCode: trimmedTerm,
        crn: trimmedCrn,
        sessionCount,
        roster,
      })
      const skipped = roster.length - withIds.length
      setMessage(
        `Saved Term Code/CRN and downloaded ${withIds.length} students (PR / NS)` +
          (skipped ? `; ${skipped} without Student ID omitted` : "") +
          ".",
      )
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {courseLabel} · {sectionLabel}. Export uses the same date filters as the
        attendance grid. File columns: Term Code, CRN, Student ID, Midterm Grade
        (PR / NS). Term Code and CRN are saved for this section when you
        download.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#000D26]">Term Code</span>
          <input
            value={termCode}
            onChange={(event) => setTermCode(event.target.value)}
            placeholder="e.g. 202710"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            autoComplete="off"
          />
          <span className="block text-xs text-muted-foreground">
            Found on the Experience Course Listing home page (example: 202710).
          </span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-[#000D26]">CRN</span>
          <input
            value={crn}
            onChange={(event) => setCrn(event.target.value)}
            placeholder="e.g. 11667"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            autoComplete="off"
          />
          <span className="block text-xs text-muted-foreground">
            Found on the Experience course listing page for this section.
          </span>
        </label>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onDownload}
        className="inline-flex h-9 items-center rounded-md bg-[#000D26] px-4 text-sm font-medium text-white hover:bg-[#000D26]/90 disabled:opacity-50"
      >
        {pending ? "Working…" : "Download Experience XLSX"}
      </button>
      {message ? (
        <p className="text-sm text-[#000D26]/80">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
}
