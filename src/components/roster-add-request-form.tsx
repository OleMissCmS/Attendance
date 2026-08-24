"use client"

import { requestRosterAddition } from "@/app/c/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function RosterAddRequestForm({
  sessionId,
  email,
  error,
  sessionEnded,
}: {
  sessionId: string
  email: string
  error?: string
  sessionEnded?: boolean
}) {
  const alreadyEnrolled = Boolean(error?.includes("already on this roster"))

  if (alreadyEnrolled) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <p className="text-sm text-muted-foreground">
          Rosters use @go.olemiss.edu. Enter that address on the check-in form
          (reload or scan the QR again) instead of requesting a roster add.
        </p>
      </div>
    )
  }

  return (
    <form action={requestRosterAddition} className="space-y-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="check_in_email" value={email} />
      <p className="text-sm text-destructive">
        You are not on this roster. Submit a roster addition request for your
        instructor.
      </p>
      <p className="text-sm text-muted-foreground">
        Take your time filling this out. You do not need a new classroom code.
        Use your student email (usually username@go.olemiss.edu).
      </p>
      {sessionEnded ? (
        <p role="status" className="text-sm text-amber-800">
          This attendance session has ended. You can still submit the request
          so your instructor can add you.
        </p>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="last_name">Last Name</Label>
        <Input
          id="last_name"
          name="last_name"
          required
          autoComplete="family-name"
          placeholder="(e.g. Smith)"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="first_name">First Name</Label>
        <Input
          id="first_name"
          name="first_name"
          required
          autoComplete="given-name"
          placeholder="(e.g. Jordan)"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="network_id">Network ID</Label>
        <Input
          id="network_id"
          name="network_id"
          required
          autoComplete="username"
          placeholder="(e.g. jsmith)"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="student_id">Student ID</Label>
        <Input
          id="student_id"
          name="student_id"
          required
          inputMode="numeric"
          placeholder="(e.g. 12345678)"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="request_email">Email</Label>
        <Input
          id="request_email"
          name="email"
          type="email"
          required
          defaultValue={email}
          placeholder="(e.g. you@go.olemiss.edu)"
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full">
        Request Roster Addition
      </Button>
    </form>
  )
}
