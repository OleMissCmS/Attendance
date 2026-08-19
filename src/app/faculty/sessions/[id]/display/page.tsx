import { SessionDisplay } from "@/components/session-display"
import { Button } from "@/components/ui/button"
import { requireFaculty } from "@/lib/auth"
import { formatSectionLabel } from "@/lib/section-label"
import { isTestMode } from "@/lib/test-mode"
import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function DisplayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  await requireFaculty()
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: session } = await supabase
    .from("attendance_sessions")
    .select("*, sections(*, courses(*))")
    .eq("id", id)
    .maybeSingle()

  const section = session?.sections
  const course = section?.courses
  if (!session || !section || !course) notFound()

  if (session.ended_at || error === "end") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-[#000D26] px-4 text-center text-white">
        <p className="text-xl font-extrabold">
          {error === "end"
            ? "This session could not be ended."
            : "This session has ended."}
        </p>
        <Button
          asChild
          size="lg"
          className="h-12 bg-white px-6 text-base font-extrabold text-[#000D26] hover:bg-[#A1C6E7]"
        >
          <Link href="/faculty">Back to Courses</Link>
        </Button>
      </div>
    )
  }

  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  const origin = host ? `${proto}://${host}` : "http://localhost:3000"

  return (
    <SessionDisplay
      sessionId={session.id}
      sectionId={section.id}
      courseCode={course.code}
      courseName={course.name}
      sectionLabel={formatSectionLabel(section)}
      origin={origin}
      clickableQr={isTestMode()}
    />
  )
}
