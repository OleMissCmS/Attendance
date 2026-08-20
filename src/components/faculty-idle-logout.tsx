"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/** 5 hours of no pointer/keyboard/scroll activity → sign out faculty. */
export const FACULTY_IDLE_MS = 5 * 60 * 60 * 1000
const CHECK_EVERY_MS = 60_000

export function FacultyIdleLogout() {
  const lastActivity = useRef(Date.now())
  const signingOut = useRef(false)

  useEffect(() => {
    function bump() {
      lastActivity.current = Date.now()
    }

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "pointerdown",
    ]
    for (const event of events) {
      window.addEventListener(event, bump, { passive: true })
    }
    document.addEventListener("visibilitychange", bump)

    async function signOutIdle() {
      if (signingOut.current) return
      signingOut.current = true
      try {
        const supabase = createClient()
        await supabase.auth.signOut()
      } finally {
        window.location.assign("/login?error=idle")
      }
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= FACULTY_IDLE_MS) {
        void signOutIdle()
      }
    }, CHECK_EVERY_MS)

    return () => {
      window.clearInterval(timer)
      for (const event of events) {
        window.removeEventListener(event, bump)
      }
      document.removeEventListener("visibilitychange", bump)
    }
  }, [])

  return null
}
