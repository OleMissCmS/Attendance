import { isActiveRecord } from "@/lib/active"
import { isAdvisorRole } from "@/lib/faculty-email"
import { loadAuthorizedCourses } from "@/lib/faculty-access"
import { createClient } from "@/lib/supabase/server"
import type { Course, Profile, Section } from "@/lib/supabase/types"

export type AnalyticsCatalogCourse = Course & { sections: Section[] }

/** Full catalog for advisors; owned/guest courses for faculty, guests, and platform admins. */
export async function loadMyAnalyticsScope(profile: Profile) {
  if (isAdvisorRole(profile.role)) {
    return loadAnalyticsCatalog()
  }
  return loadAuthorizedCourses(profile)
}

export async function loadAnalyticsCatalog() {
  const supabase = await createClient()
  const { data: courses } = await supabase
    .from("courses")
    .select("*, sections(*)")
    .is("deleted_at", null)
    .order("code")

  return (courses ?? [])
    .filter(isActiveRecord)
    .map((course) => ({
      ...course,
      sections: (course.sections ?? []).filter(isActiveRecord),
    })) as AnalyticsCatalogCourse[]
}
