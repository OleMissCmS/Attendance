"use client"

import { useId, useState } from "react"
import { createSection } from "@/app/faculty/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isPlaceholderValue } from "@/lib/student-identity"

export function CreateSectionForm({
  courseId,
  courseCode,
}: {
  courseId: number
  courseCode: string
}) {
  const [termError, setTermError] = useState("")
  const [numberError, setNumberError] = useState("")
  const termId = `term-${courseId}`
  const numberId = `section-number-${courseId}`
  const termHelp = useId()
  const numberHelp = useId()

  return (
    <form
      action={createSection}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-[#d5dbe3] bg-[#F4F6F8] p-3"
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget)
        const term = String(data.get("term") ?? "").trim()
        const number = String(data.get("section_number") ?? "").trim()
        const nextTerm = !term
          ? "Enter a term"
          : isPlaceholderValue(term)
            ? "Use a real term such as Fall 2026"
            : ""
        const nextNumber = !number
          ? "Enter a section number"
          : isPlaceholderValue(number)
            ? "Use a real section number such as 001"
            : ""
        setTermError(nextTerm)
        setNumberError(nextNumber)
        if (nextTerm || nextNumber) {
          event.preventDefault()
          const target = nextTerm
            ? event.currentTarget.querySelector<HTMLInputElement>(`#${termId}`)
            : event.currentTarget.querySelector<HTMLInputElement>(`#${numberId}`)
          target?.focus()
        }
      }}
    >
      <input type="hidden" name="course_id" value={courseId} />
      <div className="space-y-1">
        <Label htmlFor={termId}>Term</Label>
        <Input
          id={termId}
          name="term"
          placeholder="(e.g. Fall 2026)"
          required
          aria-invalid={termError ? true : undefined}
          aria-describedby={termError ? termHelp : undefined}
          aria-label={`Term for ${courseCode}`}
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
          placeholder="(e.g. 001)"
          required
          aria-invalid={numberError ? true : undefined}
          aria-describedby={numberError ? numberHelp : undefined}
          aria-label={`Section number for ${courseCode}`}
        />
        {numberError ? (
          <p id={numberHelp} role="alert" className="text-sm text-destructive">
            {numberError}
          </p>
        ) : null}
      </div>
      <Button type="submit" variant="outline">
        Add section
      </Button>
    </form>
  )
}
