import { getProfile } from "@/lib/auth"
import { hasFacultyAppAccess } from "@/lib/faculty-email"
import { redirect } from "next/navigation"

export default async function HomePage() {
  const profile = await getProfile()
  if (profile && hasFacultyAppAccess(profile.role)) redirect("/faculty")
  redirect("/student")
}
