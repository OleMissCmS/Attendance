import { Suspense } from "react"
import { SiteChrome } from "@/components/site-chrome"
import { TutorialGuide } from "@/components/tutorial/tutorial-guide"
import { getProfile } from "@/lib/auth"

export const metadata = {
  title: "Faculty tutorial · Attendance Tracker",
  description:
    "Step-by-step guide for Ole Miss faculty using Attendance Tracker: courses, check-in, reports, and account settings.",
}

export default async function TutorialPage() {
  const profile = await getProfile()

  return (
    <SiteChrome profile={profile}>
      <Suspense
        fallback={
          <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
            Loading tutorial…
          </div>
        }
      >
        <TutorialGuide />
      </Suspense>
    </SiteChrome>
  )
}
