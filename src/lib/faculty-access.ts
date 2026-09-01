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

  if (advisor) {
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
      })) as AuthorizedCourse[]
  }

  const [{ data: ownedCourses }, { data: memberships }] = await Promise.all([
    supabase
      .from("courses")
      .select("*, sections(*)")
      .eq("faculty_id", facultyId)
      .is("deleted_at", null)
      .order("code"),
    supabase
      .from("section_members")
      .select("section_id, sections(*, courses(*))")
      .eq("user_id", facultyId),
  ])

  const owned = (ownedCourses ?? [])
    .filter(isActiveRecord)
    .map((course) => ({
      ...course,
      sections: (course.sections ?? []).filter(isActiveRecord),
    })) as AuthorizedCourse[]

  const ownedCourseIds = new Set(owned.map((course) => course.id))
  const guestByCourse = new Map<number, AuthorizedCourse>()

  type GuestMembership = {
    section_id: number
    sections: (Section & {
      courses: Course | null
    }) | null
  }

  for (const membership of (memberships ?? []) as GuestMembership[]) {
    const section = membership.sections
    if (!section || !isActiveRecord(section)) continue
    const course = section.courses
    if (!course || !isActiveRecord(course)) continue
    if (ownedCourseIds.has(course.id)) continue

    let entry = guestByCourse.get(course.id)
    if (!entry) {
      entry = {
        id: course.id,
        code: course.code,
        name: course.name,
        faculty_id: course.faculty_id,
        created_at: course.created_at,
        deleted_at: course.deleted_at,
        sections: [],
      }
      guestByCourse.set(course.id, entry)
    }
    if (!entry.sections.some((row) => row.id === section.id)) {
      const { courses: _courses, ...sectionFields } = section
      entry.sections.push(sectionFields)
    }
  }

  return [...owned, ...guestByCourse.values()].sort((a, b) =>
    a.code.localeCompare(b.code),
  )
}
