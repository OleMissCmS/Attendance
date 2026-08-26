"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  applyRosterSync,
  previewRosterSync,
  type RosterSyncPreviewState,
} from "@/app/faculty/actions"
import { displayRosterName } from "@/lib/roster-diff"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type DecisionMap = Record<string, "add" | "skip" | "remove" | "keep">

export function RosterSyncWizard({ sectionId }: { sectionId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<RosterSyncPreviewState | null>(null)
  const [decisions, setDecisions] = useState<DecisionMap>({})

  function onPreview(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await previewRosterSync(formData)
      if (result.error || !result.preview) {
        setError(result.error ?? "Could not read that roster file.")
        setPreview(null)
        return
      }
      const next: DecisionMap = {}
      for (const row of result.preview.onlyInFile) {
        next[row.emailHash] = "add"
      }
      for (const row of result.preview.onlyInPsoa) {
        next[row.emailHash] = "remove"
      }
      setDecisions(next)
      setPreview(result.preview)
    })
  }

  function onApply() {
    if (!preview) return
    setError(null)
    const formData = new FormData()
    formData.set("section_id", String(sectionId))
    formData.set("payload", preview.payload)
    formData.set(
      "add_hashes",
      preview.onlyInFile
        .filter((row) => decisions[row.emailHash] === "add")
        .map((row) => row.emailHash)
        .join(","),
    )
    formData.set(
      "remove_ids",
      preview.onlyInPsoa
        .filter((row) => decisions[row.emailHash] === "remove")
        .map((row) => String(row.enrollmentId))
        .filter(Boolean)
        .join(","),
    )
    startTransition(async () => {
      const result = await applyRosterSync(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/faculty/sections/${sectionId}?synced=1`)
      router.refresh()
    })
  }

  if (!preview) {
    return (
      <form action={onPreview} className="space-y-4">
        <input type="hidden" name="section_id" value={sectionId} />
        <div className="space-y-1">
          <Label htmlFor="roster_file">Blackboard Grade Center file</Label>
          <Input
            id="roster_file"
            name="roster_file"
            type="file"
            accept=".csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
          <p className="text-xs text-muted-foreground">
            Upload a fresh Blackboard (or Insight/Experience) Grade Center
            download. We will compare it to the current PSOA roster before
            changing anything.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="roster">Or paste Grade Center text</Label>
          <Textarea
            id="roster"
            name="roster"
            rows={6}
            placeholder={"(e.g. Last Name\tFirst Name\tUsername\tStudent ID)"}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Comparing…" : "Compare with PSOA roster"}
        </Button>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review differences, then apply. Matching uses Ole Miss username /
        go.olemiss.edu email (same as check-in).
      </p>

      <DiffSection
        title={`On Blackboard, not on PSOA (${preview.onlyInFile.length})`}
        empty="None — every Blackboard student is already on PSOA."
        rows={preview.onlyInFile}
        decisions={decisions}
        options={[
          { value: "add", label: "Add to PSOA" },
          { value: "skip", label: "Do not add" },
        ]}
        onChange={(hash, value) =>
          setDecisions((prev) => ({ ...prev, [hash]: value }))
        }
      />

      <DiffSection
        title={`On PSOA, not on Blackboard (${preview.onlyInPsoa.length})`}
        empty="None — every PSOA student is still on Blackboard."
        rows={preview.onlyInPsoa}
        decisions={decisions}
        options={[
          { value: "remove", label: "Remove from PSOA" },
          { value: "keep", label: "Keep on PSOA" },
        ]}
        onChange={(hash, value) =>
          setDecisions((prev) => ({ ...prev, [hash]: value }))
        }
      />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[#000D26]">
          On both — no change ({preview.inBoth.length})
        </h3>
        {preview.inBoth.length ? (
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-muted-foreground">
            {preview.inBoth.map((row) => (
              <li key={row.emailHash}>
                {displayRosterName(row)}
                {row.username ? ` · ${row.username}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No overlapping students.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={onApply}>
          {pending ? "Applying…" : "Apply roster changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            setPreview(null)
            setDecisions({})
            setError(null)
          }}
        >
          Upload a different file
        </Button>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  )
}

function DiffSection({
  title,
  empty,
  rows,
  decisions,
  options,
  onChange,
}: {
  title: string
  empty: string
  rows: RosterSyncPreviewState["onlyInFile"]
  decisions: DecisionMap
  options: { value: "add" | "skip" | "remove" | "keep"; label: string }[]
  onChange: (hash: string, value: "add" | "skip" | "remove" | "keep") => void
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[#000D26]">{title}</h3>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => (
            <li
              key={row.emailHash}
              className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="text-sm">
                <div className="font-medium">{displayRosterName(row)}</div>
                <div className="text-muted-foreground">
                  {[row.username, row.studentId].filter(Boolean).join(" · ")}
                </div>
              </div>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={decisions[row.emailHash] ?? options[0].value}
                onChange={(event) =>
                  onChange(
                    row.emailHash,
                    event.target.value as "add" | "skip" | "remove" | "keep",
                  )
                }
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
