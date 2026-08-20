"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { setSessionAttendance } from "@/app/faculty/actions"
import { cn } from "@/lib/utils"

export function AttendanceMarkToggle({
  sessionId,
  emailHash,
  present,
  className,
}: {
  sessionId: string
  emailHash: string
  present: boolean
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      title={
        present
          ? "Marked present — click to mark absent"
          : "Marked absent — click to mark present"
      }
      aria-label={
        present
          ? "Marked present — click to mark absent"
          : "Marked absent — click to mark present"
      }
      className={cn(
        "inline-flex min-w-[1.75rem] items-center justify-center rounded border px-1.5 py-0.5 font-mono text-sm font-bold tabular-nums transition-colors",
        present
          ? "border-emerald-700/40 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
          : "border-[#333F58]/30 bg-white text-[#000D26] hover:bg-[#F4F6F8]",
        pending && "opacity-60",
        className,
      )}
      onClick={() => {
        startTransition(async () => {
          const result = await setSessionAttendance({
            sessionId,
            emailHash,
            present: !present,
          })
          if (!result?.error) router.refresh()
        })
      }}
    >
      {present ? "1" : "0"}
    </button>
  )
}
