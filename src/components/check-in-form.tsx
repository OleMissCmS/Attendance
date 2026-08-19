"use client"

import { useEffect, useId, useState } from "react"
import { submitCheckIn } from "@/app/c/actions"
import { detectIncognito } from "@/lib/incognito"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CheckInForm({
  sessionId,
  email,
  token,
  error,
}: {
  sessionId: string
  email: string
  token: string
  error?: string
}) {
  const [incognito, setIncognito] = useState(false)
  const errorId = useId()

  useEffect(() => {
    void detectIncognito().then(setIncognito)
  }, [])

  return (
    <form action={submitCheckIn} className="space-y-3">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="incognito" value={incognito ? "1" : "0"} />
      <div className="space-y-1">
        <Label htmlFor="email">Your school email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={email}
          placeholder="(e.g. you@go.olemiss.edu)"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="token">Classroom code</Label>
        <Input
          id="token"
          name="token"
          required
          defaultValue={token}
          maxLength={6}
          className="font-mono text-2xl tracking-[0.4em] uppercase"
          placeholder="(e.g. ABC123)"
        />
        <p className="text-xs text-muted-foreground">
          No email login. A new code appears every 10 seconds. Each code
          remains valid for 30 seconds. This phone can only check in one
          student.
        </p>
      </div>
      {incognito ? (
        <p className="text-sm text-amber-700">
          Private/incognito browsing was detected. This check-in will be
          flagged for your instructor.
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full">
        Check in
      </Button>
    </form>
  )
}
