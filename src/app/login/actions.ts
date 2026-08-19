"use server"

import { redirect } from "next/navigation"
import {
  ACCOUNT_LOCKED_MESSAGE,
  GENERIC_LOGIN_ERROR,
} from "@/lib/login-lock"
import { createClient } from "@/lib/supabase/server"

function safeNextPath(next: string | null | undefined) {
  return next?.startsWith("/") && !next.startsWith("//") ? next : "/faculty"
}

export async function signInFaculty(
  email: string,
  password: string,
  next?: string | null,
): Promise<{ error: string } | undefined> {
  const supabase = await createClient()
  const normalizedEmail = email.trim().toLowerCase()

  const { data: locked } = await supabase.rpc("login_is_locked", {
    p_email: normalizedEmail,
  })
  if (locked) {
    await supabase.auth.signOut()
    return { error: ACCOUNT_LOCKED_MESSAGE }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  })

  if (error) {
    if (
      error.code === "invalid_credentials" ||
      /invalid login/i.test(error.message)
    ) {
      const { data: nowLocked } = await supabase.rpc("record_failed_login", {
        p_email: normalizedEmail,
      })
      if (nowLocked) {
        return { error: ACCOUNT_LOCKED_MESSAGE }
      }
    }
    return { error: GENERIC_LOGIN_ERROR }
  }

  const { data: lockedAfterSignIn } = await supabase.rpc("login_is_locked", {
    p_email: normalizedEmail,
  })
  if (lockedAfterSignIn) {
    await supabase.auth.signOut()
    return { error: ACCOUNT_LOCKED_MESSAGE }
  }

  await supabase.rpc("clear_own_login_failures")
  redirect(safeNextPath(next))
}
