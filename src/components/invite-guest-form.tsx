"use client"

import { useId, useMemo, useState } from "react"
import { inviteGuests } from "@/app/faculty/actions"
import { formatSectionLabel } from "@/lib/section-label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type SectionOption = {
  id: number
  term: string
  section_number: string
  label: string
}

type CourseOption = {
  id: number
  code: string
  name: string
  sections: SectionOption[]
}

export function InviteGuestForm({ courses }: { courses: CourseOption[] }) {
  const [openCourses, setOpenCourses] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(courses.map((course) => [course.id, true])),
  )
  const [emailError, setEmailError] = useState("")
  const [sectionError, setSectionError] = useState("")
  const emailHelpId = useId()
  const sectionHelpId = useId()
  const sections = useMemo(
    () => courses.flatMap((course) => course.sections ?? []),
    [courses],
  )

  return (
    <form
      action={inviteGuests}
      className="space-y-3"
      noValidate
      onSubmit={(event) => {
        const form = event.currentTarget
        const email = String(new FormData(form).get("email") ?? "").trim()
        const selected = form.querySelectorAll<HTMLInputElement>(
          'input[name="section_id"]:checked',
        )
        let invalid = false
        if (!email.includes("@")) {
          setEmailError("Enter a valid email address")
          invalid = true
        } else {
          setEmailError("")
        }
        if (!selected.length) {
          setSectionError("Select at least one section")
          invalid = true
        } else {
          setSectionError("")
        }
        if (invalid) {
          event.preventDefault()
          const first = emailError || !email.includes("@")
            ? form.querySelector<HTMLInputElement>("#guest-email")
            : form.querySelector<HTMLInputElement>('input[name="section_id"]')
          first?.focus()
        }
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="guest-email">Invite Guests (e.g., GAs)</Label>
        <Input
          id="guest-email"
          name="email"
          type="email"
          required
          placeholder="(e.g. ga@go.olemiss.edu)"
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? emailHelpId : undefined}
        />
        {emailError ? (
          <p id={emailHelpId} role="alert" className="text-sm text-destructive">
            {emailError}
          </p>
        ) : null}
      </div>
      <fieldset className="space-y-2" aria-describedby={sectionError ? sectionHelpId : undefined}>
        <legend className="text-sm font-medium">
          Courses and sections they can access
        </legend>
        <p className="text-xs text-muted-foreground">
          Select at least one section. Guests never receive every section
          automatically.
        </p>
        {courses.map((course) => {
          const panelId = `guest-course-${course.id}`
          const expanded = Boolean(openCourses[course.id])
          return (
            <div key={course.id} className="rounded-md border bg-background p-2">
              <button
                type="button"
                className="w-full text-left text-sm font-medium"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() =>
                  setOpenCourses((current) => ({
                    ...current,
                    [course.id]: !current[course.id],
                  }))
                }
              >
                {course.code} — {course.name}
              </button>
              <ul id={panelId} hidden={!expanded} className="mt-2 space-y-1">
                {course.sections?.length ? (
                  course.sections.map((section) => (
                    <li key={section.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="section_id"
                        value={section.id}
                        id={`guest-section-${section.id}`}
                      />
                      <label htmlFor={`guest-section-${section.id}`}>
                        {formatSectionLabel(section)}
                      </label>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-muted-foreground">
                    No sections yet
                  </li>
                )}
              </ul>
            </div>
          )
        })}
        {sectionError ? (
          <p id={sectionHelpId} role="alert" className="text-sm text-destructive">
            {sectionError}
          </p>
        ) : null}
        {!sections.length ? (
          <p className="text-xs text-muted-foreground">
            Add a section before inviting a guest.
          </p>
        ) : null}
      </fieldset>
      <Button type="submit" variant="outline" className="w-full">
        Make Guest
      </Button>
      <p className="text-xs text-muted-foreground">
        They sign in with email and password. If they do not have an account
        yet, access is waiting when they sign up with this email.
      </p>
    </form>
  )
}
