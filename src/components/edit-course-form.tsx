"use client"

import { useEffect, useId, useState } from "react"
import { updateCourse } from "@/app/faculty/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isPlaceholderValue } from "@/lib/student-identity"

export function EditCourseForm({
  courseId,
  code,
  name,
}: {
  courseId: number
  code: string
  name: string
}) {
  const [open, setOpen] = useState(false)
  const [codeError, setCodeError] = useState("")
  const [nameError, setNameError] = useState("")
  const titleId = useId()
  const codeId = `${titleId}-code`
  const nameId = `${titleId}-name`
  const codeHelp = useId()
  const nameHelp = useId()

  useEffect(() => {
    if (!open) return
    setCodeError("")
    setNameError("")
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit course
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
              Edit course
            </h2>
            <form
              action={updateCourse}
              className="mt-4 space-y-3"
              noValidate
              onSubmit={(event) => {
                const data = new FormData(event.currentTarget)
                const nextCode = String(data.get("code") ?? "").trim()
                const nextName = String(data.get("name") ?? "").trim()
                const codeMsg = !nextCode
                  ? "Enter a course code"
                  : isPlaceholderValue(nextCode)
                    ? "Use a real course code, not a placeholder"
                    : ""
                const nameMsg = !nextName
                  ? "Enter a course name"
                  : isPlaceholderValue(nextName)
                    ? "Use a real course name, not a placeholder"
                    : ""
                setCodeError(codeMsg)
                setNameError(nameMsg)
                if (codeMsg || nameMsg) {
                  event.preventDefault()
                  const target = codeMsg
                    ? event.currentTarget.querySelector<HTMLInputElement>(
                        `#${codeId}`,
                      )
                    : event.currentTarget.querySelector<HTMLInputElement>(
                        `#${nameId}`,
                      )
                  target?.focus()
                }
              }}
            >
              <input type="hidden" name="course_id" value={courseId} />
              <div className="space-y-1">
                <Label htmlFor={codeId}>Course Code</Label>
                <Input
                  id={codeId}
                  name="code"
                  defaultValue={code}
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
                <Label htmlFor={nameId}>Name</Label>
                <Input
                  id={nameId}
                  name="name"
                  defaultValue={name}
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
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save course</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
