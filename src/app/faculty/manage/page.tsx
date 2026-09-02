import { RosterExperienceNote } from "@/components/roster-experience-note"
import { SiteChrome } from "@/components/site-chrome"
import { ConfirmDeleteButton } from "@/components/confirm-delete-button"
import { CreateCourseForm } from "@/components/create-course-form"
import { CreateSectionForm } from "@/components/create-section-form"
import { EditCourseForm } from "@/components/edit-course-form"
import { EditSectionForm } from "@/components/edit-section-form"
import { InviteGuestForm } from "@/components/invite-guest-form"
import {
  archiveCourse,
  archiveSection,
} from "@/app/faculty/actions"
import { requireCourseOwner } from "@/lib/auth"
import { isActiveRecord } from "@/lib/active"
import { formatSectionLabel } from "@/lib/section-label"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function ManageCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const profile = await requireCourseOwner()
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: courses } = await supabase
    .from("courses")
    .select("*, sections(*)")
    .eq("faculty_id", profile.id)
    .is("deleted_at", null)
    .order("code")

  const owned = (courses ?? []).filter(isActiveRecord)

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[50rem] space-y-6 px-4 py-8">
        <h1 className="text-2xl font-extrabold">Manage Courses</h1>
        <p className="text-muted-foreground">
          Create a course, invite guests, or archive a course or section.
          Use Update roster to compare a new Blackboard Grade Center download
          with the current PSOA roster. Rosters, sessions, and attendance stay in
          the database when you delete.
        </p>
        <RosterExperienceNote className="text-sm" />
        {error === "course" || error === "missing" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            Enter a course code and name.
          </p>
        ) : null}
        {error === "placeholder" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            Use a real course code, name, term, or section number instead of a
            placeholder like Term or Test.
          </p>
        ) : null}
        {error === "duplicate" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            You already have an active course with that code.
          </p>
        ) : null}
        {error === "section-duplicate" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            That term and section number already exist for this course.
          </p>
        ) : null}
        {error === "section-missing" || error === "section" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            Enter a term and section number.
          </p>
        ) : null}
        {error === "invite" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            Enter a valid email and select at least one section.
          </p>
        ) : null}
        {error === "owner" ? (
          <p role="alert" className="text-sm font-medium text-[#CE1126]">
            Only the course owner can edit or delete this item.
          </p>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>Create course</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCourseForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Invite Guests (e.g., GAs)</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteGuestForm
              courses={owned.map((course) => ({
                id: course.id,
                code: course.code,
                name: course.name,
                sections: (course.sections ?? [])
                  .filter(isActiveRecord)
                  .map((section) => ({
                    id: section.id,
                    term: section.term,
                    section_number: section.section_number,
                    label: section.label,
                  })),
              }))}
            />
          </CardContent>
        </Card>
        {!owned.length ? (
          <p className="text-muted-foreground">You do not own any courses.</p>
        ) : (
          owned.map((course) => {
            const sections = (course.sections ?? []).filter(isActiveRecord)
            return (
              <Card key={course.id} className="overflow-hidden pt-0">
                <CardHeader className="flex flex-row items-center justify-between gap-4 bg-[#A1C6E7] px-4 py-1.5 text-[#000D26]">
                  <CardTitle className="text-[#000D26]">
                    {course.code} — {course.name}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <EditCourseForm
                      courseId={course.id}
                      code={course.code}
                      name={course.name}
                    />
                    <ConfirmDeleteButton
                      action={archiveCourse}
                      hidden={{ course_id: String(course.id) }}
                      label="Delete course"
                      confirmMessage={`Archive ${course.code} ${course.name} and all of its sections? Data is kept.`}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sections.length ? (
                    sections.map((section) => (
                      <div
                        key={section.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b py-2 last:border-0"
                      >
                        <span className="font-bold">
                          {formatSectionLabel(section)}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/faculty/sections/${section.id}/roster-sync`}
                            className="inline-flex h-8 items-center rounded-md border border-[#000D26]/20 bg-white px-3 text-sm font-medium text-[#000D26] hover:bg-white/80"
                          >
                            Update roster
                          </Link>
                          <EditSectionForm
                            sectionId={section.id}
                            term={section.term}
                            sectionNumber={section.section_number}
                            courseCode={course.code}
                          />
                          <ConfirmDeleteButton
                            action={archiveSection}
                            hidden={{ section_id: String(section.id) }}
                            label="Delete section"
                            confirmMessage={`Archive ${course.code} ${formatSectionLabel(section)}? Data is kept.`}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No active sections.
                    </p>
                  )}
                  <CreateSectionForm
                    courseId={course.id}
                    courseCode={course.code}
                  />
                </CardContent>
              </Card>
            )
          })
        )}
      </main>
    </SiteChrome>
  )
}
