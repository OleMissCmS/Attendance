"use client"

import { useEffect, useId, useState } from "react"
import { updateSection } from "@/app/faculty/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isPlaceholderValue } from "@/lib/student-identity"

export function EditSectionForm({
  sectionId,
  term,
  sectionNumber,
  courseCode,
}: {
  sectionId: number
  term: string
  sectionNumber: string
  courseCode: string
}) {
  const [open, setOpen] = useState(false)
  const [termError, setTermError] = useState("")
  const [numberError, setNumberError] = useState("")
  const titleId = useId()
  const termId = `${titleId}-term`
  const numberId = `${titleId}-number`
  const termHelp = useId()
  const numberHelp = useId()

  useEffect(() => {
    if (!open) return
    setTermError("")
    setNumberError("")
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit section
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#000D26]/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-md rounded-lg border border-[#333F58] bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className="text-lg font-extrabold text-[#000D26]">
              Edit section
            </h2>
            <p className="mt-1 text-sm text-[#333F58]">{courseCode}</p>
            <form
              action={updateSection}
              className="mt-4 space-y-3"
              noValidate
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget)
                const nextTerm = String(data.get("term") ?? "").trim()
                const nextNumber = String(data.get("section_number") ?? "").trim()
                const termMsg = !nextTerm
                  ? "Enter a term"
                  : isPlaceholderValue(nextTerm)
                    ? "Use a real term such as Fall 2026"
                    : ""
                const numberMsg = !nextNumber
                  ? "Enter a section number"
                  : isPlaceholderValue(nextNumber)
                    ? "Use a real section number such as 001"
                    : ""
                setTermError(termMsg)
                setNumberError(numberMsg)
                if (termMsg || numberMsg) {
                  event.preventDefault()
                  const target = termMsg
                    ? event.currentTarget.querySelector<HTMLInputElement>(
                        `#${termId}`,
                      )
                    : event.currentTarget.querySelector<HTMLInputElement>(
                        `#${numberId}`,
                      )
                  target?.focus()
                }
              }}
            >
              <input type="hidden" name="section_id" value={sectionId} />
              <div className="space-y-1">
                <Label htmlFor={termId}>Term</Label>
                <Input
                  id={termId}
                  name="term"
                  defaultValue={term}
                  placeholder="(e.g. Fall 2026)"
                  required
                  aria-invalid={termError ? true : undefined}
                  aria-describedby={termError ? termHelp : undefined}
                />
                {termError ? (
                  <p id={termHelp} role="alert" className="text-sm text-destructive">
                    {termError}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1">
                <Label htmlFor={numberId}>Section Number</Label>
                <Input
                  id={numberId}
                  name="section_number"
                  defaultValue={sectionNumber}
                  placeholder="(e.g. 001)"
                  required
                  aria-invalid={numberError ? true : undefined}
                  aria-describedby={numberError ? numberHelp : undefined}
                />
                {numberError ? (
                  <p
                    id={numberHelp}
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {numberError}
                  </p>
                ) : null}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save section</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
