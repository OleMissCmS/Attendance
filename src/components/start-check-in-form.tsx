"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { startCheckInSessions } from "@/app/faculty/actions"
import { formatSectionLabel } from "@/lib/section-label"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export type StartCheckInSection = {
  id: number
  term: string
  section_number: string
  label: string
  liveSessionId: string | null
}

export type StartCheckInCourse = {
  id: number
  code: string
  name: string
  sections: StartCheckInSection[]
}

export type StartedSessionLink = {
  id: string
  label: string
  reused?: boolean
}

export function StartCheckInForm({
  courses,
  startedSessions = [],
  error,
}: {
  courses: StartCheckInCourse[]
  startedSessions?: StartedSessionLink[]
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Record<number, boolean>>({})
  const rootRef = useRef<HTMLFormElement>(null)
  const openedProjectors = useRef(false)

  const allowedIds = useMemo(
    () =>
      new Set(
        courses.flatMap((course) => course.sections.map((section) => section.id)),
      ),
    [courses],
  )
  const selectedIds = Object.entries(selected)
    .filter(([, checked]) => checked)
    .map(([id]) => Number(id))
    .filter((id) => allowedIds.has(id))

  const count = selectedIds.length
  const triggerLabel = count
    ? `${count} section${count === 1 ? "" : "s"} selected`
    : "Select sections"

  useEffect(() => {
    if (openedProjectors.current || !startedSessions.length) return
    openedProjectors.current = true
    const urls = startedSessions.map(
      (session) => `/faculty/sessions/${session.id}/display`,
    )
    for (let i = 0; i < urls.length; i++) {
      const popup = window.open(urls[i], "_blank", "noopener,noreferrer")
      if (!popup) {
        if (i === 0) window.location.assign(urls[i])
        break
      }
    }
    const url = new URL(window.location.href)
    url.searchParams.delete("started")
    url.searchParams.delete("reused")
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, "", next)
  }, [startedSessions])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  return (
    <form ref={rootRef} action={startCheckInSessions} className="space-y-3">
      {startedSessions.length ? (
        <div
          role="status"
          className="space-y-2 rounded-md border border-[#A1C6E7] bg-[#F4F6F8] p-3"
        >
          <p className="text-sm font-extrabold">Session is live</p>
          <p className="text-xs text-muted-foreground">
            Start Session for the classroom that needs the QR code.
          </p>
          <ul className="space-y-1 text-sm">
            {startedSessions.map((session) => (
              <li key={session.id}>
                <p>
                  {session.reused
                    ? `Reused the existing session for ${session.label}.`
                    : `Created a new session for ${session.label}.`}
                </p>
                <a
                  href={`/faculty/sessions/${session.id}/display`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[#000D26] underline-offset-4 hover:text-[#333F58] hover:underline"
                >
                  Start Session — {session.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not start a check-in session. Select an active section you can
          access and try again.
        </p>
      ) : null}
      {!courses.length ? (
        <p className="text-sm text-muted-foreground">
          Add a section before starting check-in.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="start-sections">Sections</Label>
            <p className="text-xs text-muted-foreground">
              Check every section that should go live, then click Start
              Check-In Session.
            </p>
            <button
              id="start-sections"
              type="button"
              aria-expanded={open}
              aria-haspopup="listbox"
              onClick={() => setOpen((current) => !current)}
              className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm"
            >
              <span className={count ? "font-medium" : "text-muted-foreground"}>
                {triggerLabel}
              </span>
              <span className="text-xs text-[#333F58]" aria-hidden>
                {open ? "▴" : "▾"}
              </span>
            </button>
            <div
              role="listbox"
              aria-multiselectable="true"
              hidden={!open}
              className="max-h-80 overflow-auto rounded-md border border-[#d5dbe3] bg-white shadow-md"
            >
              {courses.map((course) => (
                <div key={course.id}>
                  <div className="sticky top-0 bg-[#000D26] px-3 py-1.5 text-xs font-extrabold tracking-wide text-white">
                    {course.code} — {course.name}
                  </div>
                  <ul>
                    {course.sections.map((section) => (
                      <li
                        key={section.id}
                        className="border-b border-[#e8ecf2] last:border-b-0"
                      >
                        <label
                          htmlFor={`start-section-${section.id}`}
                          className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-[#F4F6F8]"
                        >
                          <input
                            type="checkbox"
                            id={`start-section-${section.id}`}
                            name="section_id"
                            value={section.id}
                            checked={Boolean(selected[section.id])}
                            onChange={(event) =>
                              setSelected((current) => ({
                                ...current,
                                [section.id]: event.target.checked,
                              }))
                            }
                            className="mt-1"
                          />
                          <span className="flex-1">
                            <span className="font-extrabold text-[#000D26]">
                              {formatSectionLabel(section)}
                            </span>
                            {section.liveSessionId ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                Already live — starting reuses this session.{" "}
                                <a
                                  href={`/faculty/sessions/${section.liveSessionId}/display`}
                                  className="font-bold underline-offset-4 hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Start Session
                                </a>
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full sm:w-auto" disabled={!count}>
            Start Check-In Session
          </Button>
        </>
      )}
    </form>
  )
}
