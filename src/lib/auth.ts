import { hasFacultyAppAccess } from "@/lib/faculty-email"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Database, Profile } from "@/lib/supabase/types"
import type { SupabaseClient } from "@supabase/supabase-js"

async function loadProfile() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId || typeof userId !== "string") {
    return { supabase, profile: null }
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  return { supabase, profile: data }
}

async function redirectIfLocked(
  supabase: SupabaseClient<Database>,
  email: string,
) {
  const { data: locked } = await supabase.rpc("login_is_locked", {
    p_email: email,
  })
  if (locked) redirect("/auth/locked")
}

export async function getProfile(): Promise<Profile | null> {
  const { supabase, profile } = await loadProfile()
  if (!profile) return null
  await redirectIfLocked(supabase, profile.email)
  return profile
}

export async function requireProfile(): Promise<Profile> {
  const { supabase, profile } = await loadProfile()
  if (!profile) redirect("/login")
  await redirectIfLocked(supabase, profile.email)
  return profile
}

export async function requireFaculty(): Promise<Profile> {
  const profile = await requireProfile()
  if (!hasFacultyAppAccess(profile.role)) redirect("/login")
  return profile
}

export async function requireCourseOwner(): Promise<Profile> {
  const profile = await requireFaculty()
  if (profile.role !== "faculty") redirect("/faculty")
  return profile
}
