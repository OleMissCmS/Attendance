import { isActiveRecord } from "@/lib/active"
import { isAdvisorRole } from "@/lib/faculty-email"
import { createClient } from "@/lib/supabase/server"
import type { Course, Profile, Section } from "@/lib/supabase/types"

export type AuthorizedCourse = Course & { sections: Section[] }

export async function loadAuthorizedCourses(profile: Profile | string) {
  const facultyId = typeof profile === "string" ? profile : profile.id
  const advisor =
    typeof profile === "string" ? false : isAdvisorRole(profile.role)
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
    }))
    .filter(
      (course) =>
        advisor ||
        course.faculty_id === facultyId ||
        course.sections.length > 0,
    ) as AuthorizedCourse[]
}
