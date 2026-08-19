"use client"

import { useId, useState } from "react"
import { createCourse } from "@/app/faculty/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isPlaceholderValue } from "@/lib/student-identity"

export function CreateCourseForm() {
  const [codeError, setCodeError] = useState("")
  const [nameError, setNameError] = useState("")
  const codeHelp = useId()
  const nameHelp = useId()

  return (
    <form
      action={createCourse}
      className="grid gap-3 sm:grid-cols-2"
      noValidate
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget)
        const code = String(data.get("code") ?? "").trim()
        const name = String(data.get("name") ?? "").trim()
        const nextCode = !code
          ? "Enter a course code"
          : isPlaceholderValue(code)
            ? "Use a real course code, not a placeholder"
            : ""
        const nextName = !name
          ? "Enter a course name"
          : isPlaceholderValue(name)
            ? "Use a real course name, not a placeholder"
            : ""
        setCodeError(nextCode)
        setNameError(nextName)
        if (nextCode || nextName) {
          event.preventDefault()
          const target = nextCode
            ? event.currentTarget.querySelector<HTMLInputElement>("#code")
            : event.currentTarget.querySelector<HTMLInputElement>("#name")
          target?.focus()
        }
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="code">Course Code</Label>
        <Input
          id="code"
          name="code"
          placeholder="(e.g. ACCY 201)"
          required
          aria-invalid={codeError ? true : undefined}
          aria-describedby={codeError ? codeHelp : undefined}
        />
        {codeError ? (
          <p id={codeHelp} role="alert" className="text-sm text-destructive">
            {codeError}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="(e.g. Introduction to Accounting)"
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? nameHelp : undefined}
        />
        {nameError ? (
          <p id={nameHelp} role="alert" className="text-sm text-destructive">
            {nameError}
          </p>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit">Create course</Button>
      </div>
    </form>
  )
}
