"use client"

import { useEffect, useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CONFIRM_WORD = "Delete"

export function ConfirmDeleteButton({
  action,
  hidden,
  label,
  confirmMessage,
}: {
  action: (formData: FormData) => void | Promise<void>
  hidden: Record<string, string>
  label: string
  confirmMessage: string
}) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const titleId = useId()
  const matches = typed.trim() === CONFIRM_WORD

  useEffect(() => {
    if (!open) return
    setTyped("")
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
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
              Confirm deletion
            </h2>
            <p className="mt-2 text-sm text-[#333F58]">{confirmMessage}</p>
            <p className="mt-3 text-sm text-[#333F58]">
              Type <span className="font-extrabold">{CONFIRM_WORD}</span> to
              confirm. This cannot be undone from the faculty page. Attendance
              data is kept in the database.
            </p>
            <form action={action} className="mt-4 space-y-4">
              {Object.entries(hidden).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <div className="space-y-1">
                <Label htmlFor={`${titleId}-confirm`}>
                  Type {CONFIRM_WORD} to confirm
                </Label>
                <Input
                  ref={inputRef}
                  id={`${titleId}-confirm`}
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  autoComplete="off"
                  placeholder={CONFIRM_WORD}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={!matches}>
                  {label}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
