"use server"

import { requireFaculty } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export async function changePassword(
  formData: FormData,
): Promise<{ error?: string }> {
  const profile = await requireFaculty()
  const currentPassword = String(formData.get("current_password") ?? "")
  const newPassword = String(formData.get("new_password") ?? "")
  const confirmPassword = String(formData.get("confirm_password") ?? "")

  if (!currentPassword) {
    return { error: "Enter your current password." }
  }
  if (newPassword.length < 6) {
    return { error: "New password must be at least 6 characters." }
  }
  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." }
  }
  if (newPassword === currentPassword) {
    return { error: "Choose a different password than your current one." }
  }

  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email.trim().toLowerCase(),
    password: currentPassword,
  })
  if (verifyError) {
    return { error: "Current password is incorrect." }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) {
    return { error: "Could not update password. Try again." }
  }

  return {}
}
