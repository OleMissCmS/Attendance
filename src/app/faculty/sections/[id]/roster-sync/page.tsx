import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteChrome } from "@/components/site-chrome"
import { RosterSyncWizard } from "@/components/roster-sync-wizard"
import { requireFaculty } from "@/lib/auth"
import { canManageAttendanceData } from "@/lib/faculty-email"
import { formatSectionLabel } from "@/lib/section-label"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function RosterSyncPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireFaculty()
  const canManage = canManageAttendanceData(profile.role)
  const { id } = await params
  const sectionId = Number(id)
  const supabase = await createClient()

  const { data: section } = await supabase
    .from("sections")
    .select("*, courses(*)")
    .eq("id", sectionId)
    .maybeSingle()

  if (!section || section.deleted_at) notFound()
  const course = Array.isArray(section.courses)
    ? section.courses[0]
    : section.courses
  if (!course || course.deleted_at) notFound()

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[50rem] space-y-6 px-4 py-8">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/faculty/sections/${sectionId}`}
              className="font-medium text-[#000D26] underline-offset-4 hover:underline"
            >
              ← Back to section
            </Link>
          </p>
          <h1 className="text-2xl font-extrabold">Update roster from Blackboard</h1>
          <p className="text-muted-foreground">
            {course.code} {course.name} · {formatSectionLabel(section)}
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Compare Blackboard download to PSOA</CardTitle>
          </CardHeader>
          <CardContent>
            {canManage ? (
              <RosterSyncWizard sectionId={sectionId} />
            ) : (
              <p className="text-sm text-muted-foreground">
                View-only access. Advisors cannot change rosters.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </SiteChrome>
  )
}
