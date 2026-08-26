"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"
import { startRosterAddRequest, submitCheckIn } from "@/app/c/actions"
import { detectIncognito } from "@/lib/incognito"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function CheckInForm({
  sessionId,
  email,
  token,
  expiresAt,
  error,
  autoSubmit = false,
  showRosterAddLink = false,
  allowExpiredCode = false,
}: {
  sessionId: string
  email: string
  token: string
  expiresAt?: number | null
  error?: string
  /** When true, device already has a remembered email and QR code is present. */
  autoSubmit?: boolean
  /** Secondary path after a not-on-roster miss. */
  showRosterAddLink?: boolean
  /** After a not-on-roster miss, the student may reuse this session without a live code. */
  allowExpiredCode?: boolean
}) {
  const [incognito, setIncognito] = useState(false)
  const [tokenValue, setTokenValue] = useState(token)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [autoCheckingIn, setAutoCheckingIn] = useState(false)
  const [isPending, startTransition] = useTransition()
  const autoStarted = useRef(false)
  const errorId = useId()

  useEffect(() => {
    let cancelled = false

    async function prepare() {
      const isIncognito = await detectIncognito()
      if (cancelled) return
      setIncognito(isIncognito)

      const code = token.trim().toUpperCase()
      if (
        !autoSubmit ||
        error ||
        !email.includes("@") ||
        code.length !== 6 ||
        autoStarted.current
      ) {
        return
      }

      autoStarted.current = true
      setAutoCheckingIn(true)

      const formData = new FormData()
      formData.set("session_id", sessionId)
      formData.set("email", email)
      formData.set("token", code)
      formData.set("incognito", isIncognito ? "1" : "0")

      startTransition(() => {
        void submitCheckIn(formData)
      })
    }

    void prepare()
    return () => {
      cancelled = true
    }
  }, [autoSubmit, email, error, sessionId, token])

  useEffect(() => {
    setTokenValue(token)
  }, [token])

  useEffect(() => {
    const normalized = tokenValue.trim().toUpperCase()
    if (normalized.length !== 6) {
      setSecondsLeft(null)
      return
    }

    let cancelled = false
    let timer: number | undefined

    async function syncExpiry() {
      // Prefer expiry from QR URL when it still matches this token.
      if (
        expiresAt != null &&
        Number.isFinite(expiresAt) &&
        token.trim().toUpperCase() === normalized
      ) {
        const remaining = Math.max(
          0,
          Math.ceil(expiresAt - Date.now() / 1000),
        )
        if (!cancelled) setSecondsLeft(remaining)
        return
      }

      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc("code_expires_in", {
        p_session_id: sessionId,
        p_token: normalized,
      })
      if (cancelled) return
      if (rpcError || typeof data !== "number") {
        setSecondsLeft(null)
        return
      }
      setSecondsLeft(Math.max(0, data))
    }

    void syncExpiry()
    timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current == null) return current
        return Math.max(0, current - 1)
      })
    }, 1000)

    // Re-sync occasionally in case of clock drift / late page open.
    const resync = window.setInterval(() => {
      void syncExpiry()
    }, 5000)

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
      window.clearInterval(resync)
    }
  }, [expiresAt, sessionId, token, tokenValue])

  if (autoCheckingIn || isPending) {
    return (
      <div
        role="status"
        className="space-y-2 rounded-md bg-emerald-50/80 p-3 text-sm text-emerald-900"
        aria-busy="true"
      >
        <p className="font-extrabold">Checking you in…</p>
        <p>Using the email saved on this phone.</p>
        {incognito ? (
          <p className="text-amber-800">
            Private/incognito browsing was detected. This check-in will be
            flagged for your instructor.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
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
            required={!allowExpiredCode}
            value={tokenValue}
            onChange={(event) =>
              setTokenValue(event.target.value.toUpperCase().slice(0, 6))
            }
            maxLength={6}
            className="font-mono text-2xl tracking-[0.4em] uppercase"
            placeholder="(e.g. ABC123)"
          />
          {secondsLeft != null && tokenValue.trim().length === 6 ? (
            <p
              className={
                secondsLeft === 0 && !allowExpiredCode
                  ? "text-xs font-medium text-destructive"
                  : "text-xs text-muted-foreground"
              }
              aria-live="polite"
            >
              {secondsLeft === 0
                ? allowExpiredCode
                  ? "This code’s timer ended, but you can still check in after correcting your email."
                  : "This code has expired. Enter the newest code from the classroom screen."
                : `This code will expire in ${secondsLeft} second${secondsLeft === 1 ? "" : "s"}.`}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            No email login. This phone can only check in one student.
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
      {showRosterAddLink ? (
        <form action={startRosterAddRequest} className="space-y-2 border-t pt-3">
          <input type="hidden" name="session_id" value={sessionId} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="token" value={tokenValue} />
          <p className="text-xs text-muted-foreground">
            Already tried @go.olemiss.edu and still not listed?
          </p>
          <Button type="submit" variant="outline" className="w-full">
            Request roster addition
          </Button>
        </form>
      ) : null}
    </div>
  )
}
