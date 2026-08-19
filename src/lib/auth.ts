import { hasFacultyAppAccess } from "@/lib/faculty-email"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/supabase/types"

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId || typeof userId !== "string") return null

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle()

  return data
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect("/login")
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
