"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { endSession } from "@/app/faculty/actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const POLL_MS = 2000
const ROTATE_MS = 15_000
const ROTATE_SECONDS = ROTATE_MS / 1000

export function SessionDisplay({
  sessionId,
  sectionId,
  courseCode,
  courseName,
  sectionLabel,
  origin,
  clickableQr = false,
}: {
  sessionId: string
  sectionId: number
  courseCode: string
  courseName: string
  sectionLabel: string
  origin: string
  clickableQr?: boolean
}) {
  const [code, setCode] = useState("------")
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [qr, setQr] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const courseTitle = useMemo(() => {
    const codeLabel = courseCode.trim()
    const name = courseName.trim()
    if (!name || name.toLowerCase() === codeLabel.toLowerCase()) return codeLabel
    return `${codeLabel} ${name}`
  }, [courseCode, courseName])

  const checkInUrl = useMemo(() => {
    const url = new URL(`${origin}/c/${sessionId}`)
    url.searchParams.set("t", code)
    if (expiresAt != null) url.searchParams.set("exp", String(expiresAt))
    return url.toString()
  }, [origin, sessionId, code, expiresAt])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function refresh() {
      const { data, error: rpcError } = await supabase.rpc(
        "session_display_code",
        { p_session_id: sessionId },
      )
      if (cancelled) return
      if (rpcError) {
        setError(rpcError.message)
        return
      }
      const payload = data as {
        code?: string
        expires_at?: number
      } | null
      const nextCode = payload?.code ?? "------"
      setCode(nextCode)
      setExpiresAt(
        typeof payload?.expires_at === "number" ? payload.expires_at : null,
      )
      setError(null)
    }

    void refresh()
    const timer = setInterval(() => void refresh(), POLL_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [sessionId])

  useEffect(() => {
    if (!code || code === "------") return
    const started = Date.now()
    setProgress(0)
    const timer = window.setInterval(() => {
      setProgress(Math.min(1, (Date.now() - started) / ROTATE_MS))
    }, 200)
    return () => window.clearInterval(timer)
  }, [code])

  useEffect(() => {
    if (!code || code === "------") return
    void QRCode.toDataURL(checkInUrl, {
      width: 640,
      margin: 1,
      color: { dark: "#000D26", light: "#ffffff" },
    }).then(setQr)
  }, [checkInUrl, code])

  async function enterFullscreen() {
    await document.documentElement.requestFullscreen?.()
  }

  const qrClass =
    "h-[clamp(12rem,54vmin,28rem)] w-[clamp(12rem,54vmin,28rem)] rounded-lg bg-white p-3"

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#000D26] text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/80 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-wide">Live attendance</p>
          <p className="truncate text-xl font-extrabold text-white">
            {courseTitle}
          </p>
          <p className="font-bold">{sectionLabel}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void enterFullscreen()}
          >
            Enter fullscreen
          </Button>
          <form action={endSession}>
            <input type="hidden" name="session_id" value={sessionId} />
            <input type="hidden" name="section_id" value={sectionId} />
            <Button type="submit" variant="secondary">
              End session
            </Button>
          </form>
        </div>
      </div>
      <div className="h-2.5 bg-[#CE1126]" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 sm:gap-6 sm:p-6">
        {qr ? (
          clickableQr ? (
            <a href={checkInUrl} className="block">
              {/* QR is a generated data URL, not a static asset. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="Attendance check-in QR code (click to open check-in)"
                className={qrClass}
              />
            </a>
          ) : (
            // QR is a generated data URL, not a static asset.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="Attendance check-in QR code"
              className={qrClass}
            />
          )
        ) : (
          <div className={qrClass.replace("bg-white p-3", "bg-[#333F58]")} />
        )}
        <div className="max-w-lg text-center">
          <p className="text-sm font-bold tracking-[0.2em] text-[#A1C6E7]">
            Classroom code
          </p>
          <p className="mt-1 font-mono text-6xl font-bold tracking-[0.3em] sm:text-7xl">
            {code}
          </p>
          <div
            className="mx-auto mt-3 h-1.5 w-48 overflow-hidden rounded-full bg-white/20"
            role="meter"
            aria-label="Time until a new code appears"
            aria-valuemin={0}
            aria-valuemax={ROTATE_SECONDS}
            aria-valuenow={Math.round((1 - progress) * ROTATE_SECONDS)}
          >
            <div
              className="h-full bg-[#A1C6E7]"
              style={{ width: `${Math.max(0, (1 - progress) * 100)}%` }}
            />
          </div>
          <p className="sr-only">
            About {Math.max(0, Math.round((1 - progress) * ROTATE_SECONDS))}{" "}
            seconds until a new code appears.
          </p>
          <p className="mt-3 max-w-md text-sm text-white/70">
            Once you scan this code, it will be good for 30 seconds. There is no
            need to change your code on the next screen.
          </p>
          {error ? (
            <p role="alert" className="mt-3 text-red-400">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
