"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  deleteEnrollmentQuietly,
  updateEnrollmentIdentity,
} from "@/app/faculty/actions"
import {
  parseExperienceValidationReport,
  studentIdsMatch,
  type ExperienceRosterRow,
  type ExperienceValidationIssue,
} from "@/lib/experience-export"

type MatchedIssue = ExperienceValidationIssue & {
  match: ExperienceRosterRow | null
}

export function ExperienceValidationPanel({
  sectionId,
  roster,
}: {
  sectionId: number
  roster: ExperienceRosterRow[]
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, startTransition] = useTransition()
  const [issues, setIssues] = useState<MatchedIssue[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setMessage(null)
    try {
      const buffer = await file.arrayBuffer()
      const parsed = await parseExperienceValidationReport(buffer)
      const matched = parsed.map((issue) => ({
        ...issue,
        match:
          roster.find((row) => studentIdsMatch(row.studentId, issue.studentId)) ??
          null,
      }))
      setIssues(matched)
      if (!matched.length) {
        setMessage("No errors in that validation report.")
      }
    } catch (err) {
      setIssues(null)
      setError(err instanceof Error ? err.message : "Could not read that file.")
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  function refreshAfterChange(enrollmentId: number) {
    setIssues((prev) =>
      prev
        ? prev.filter((issue) => issue.match?.enrollmentId !== enrollmentId)
        : prev,
    )
    setEditingId(null)
    router.refresh()
  }

  function onSaveEdit(formData: FormData) {
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await updateEnrollmentIdentity(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      const enrollmentId = Number(formData.get("enrollment_id"))
      setMessage("Student information updated. Re-download and re-import when ready.")
      refreshAfterChange(enrollmentId)
    })
  }

  function onDelete(enrollmentId: number) {
    if (
      !window.confirm(
        "Remove this student from the PSOA roster for this section?",
      )
    ) {
      return
    }
    setError(null)
    setMessage(null)
    const formData = new FormData()
    formData.set("section_id", String(sectionId))
    formData.set("enrollment_id", String(enrollmentId))
    startTransition(async () => {
      const result = await deleteEnrollmentQuietly(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setMessage("Student removed from the PSOA roster.")
      refreshAfterChange(enrollmentId)
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        After importing into Experience, download the validation report and
        upload it here. Only rows with errors are listed so you can fix Student
        ID / name fields or remove the student from PSOA.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={pending}
        className="inline-flex h-9 items-center rounded-md border border-primary/20 bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
        onClick={() => inputRef.current?.click()}
      >
        Upload validation report
      </button>

      {message ? (
        <p className="text-sm text-[#000D26]/80">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {issues && issues.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {issues.map((issue, index) => {
            const key = `${issue.studentId}-${issue.error}-${index}`
            const match = issue.match
            const isEditing = match && editingId === match.enrollmentId
            return (
              <li key={key} className="space-y-3 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-medium text-[#CE1126]">{issue.error}</p>
                    <p className="text-muted-foreground">
                      Report Student ID:{" "}
                      <span className="font-medium text-foreground">
                        {issue.studentId || "—"}
                      </span>
                      {issue.midtermGrade
                        ? ` · Grade ${issue.midtermGrade}`
                        : ""}
                    </p>
                    {match ? (
                      <p className="mt-1">
                        PSOA:{" "}
                        {[
                          match.lastName && match.firstName
                            ? `${match.lastName}, ${match.firstName}`
                            : null,
                          match.username,
                          match.studentId,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-amber-800">
                        No matching Student ID on this section&apos;s PSOA
                        roster (may already be fixed or removed).
                      </p>
                    )}
                  </div>
                  {match ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        className="inline-flex h-8 items-center rounded-md border border-primary/20 bg-background px-3 text-sm hover:bg-accent disabled:opacity-50"
                        onClick={() =>
                          setEditingId(isEditing ? null : match.enrollmentId)
                        }
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        className="inline-flex h-8 items-center rounded-md border border-red-200 bg-background px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
                        onClick={() => onDelete(match.enrollmentId)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                {match && isEditing ? (
                  <form action={onSaveEdit} className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="hidden"
                      name="section_id"
                      value={sectionId}
                    />
                    <input
                      type="hidden"
                      name="enrollment_id"
                      value={match.enrollmentId}
                    />
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Last name</span>
                      <input
                        name="last_name"
                        defaultValue={match.lastName}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">First name</span>
                      <input
                        name="first_name"
                        defaultValue={match.firstName}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Username</span>
                      <input
                        name="username"
                        defaultValue={match.username}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">Student ID</span>
                      <input
                        name="student_id"
                        defaultValue={match.studentId}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className="inline-flex h-9 items-center rounded-md bg-[#000D26] px-4 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {pending ? "Saving…" : "Save student"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
