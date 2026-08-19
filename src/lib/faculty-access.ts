import { isActiveRecord } from "@/lib/active"
import { createClient } from "@/lib/supabase/server"
import type { Course, Section } from "@/lib/supabase/types"

export type AuthorizedCourse = Course & { sections: Section[] }

export async function loadAuthorizedCourses(facultyId: string) {
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
        course.faculty_id === facultyId || course.sections.length > 0,
    ) as AuthorizedCourse[]
}
