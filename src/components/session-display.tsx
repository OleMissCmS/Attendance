"use client"

import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import { endSession } from "@/app/faculty/actions"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

const POLL_MS = 2000
const ROTATE_MS = 10_000

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
  const [qr, setQr] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const courseTitle = useMemo(() => {
    const code = courseCode.trim()
    const name = courseName.trim()
    if (!name || name.toLowerCase() === code.toLowerCase()) return code
    return `${code} ${name}`
  }, [courseCode, courseName])

  const checkInUrl = useMemo(
    () => `${origin}/c/${sessionId}?t=${encodeURIComponent(code)}`,
    [origin, sessionId, code],
  )

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
      const payload = data as { code?: string } | null
      const nextCode = payload?.code ?? "------"
      setCode(nextCode)
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
            aria-valuemax={10}
            aria-valuenow={Math.round((1 - progress) * 10)}
          >
            <div
              className="h-full bg-[#A1C6E7]"
              style={{ width: `${Math.max(0, (1 - progress) * 100)}%` }}
            />
          </div>
          <p className="sr-only">
            About {Math.max(0, Math.round((1 - progress) * 10))} seconds until
            a new code appears.
          </p>
          <p className="mt-3 max-w-md text-sm text-white/70">
            A new code appears every 10 seconds. Each code remains valid for 30
            seconds. Scan the QR code, then enter this classroom code to check
            in.
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
