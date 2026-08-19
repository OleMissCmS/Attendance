import Link from "next/link"
import { FacultyNav, SignOutButton } from "@/components/faculty-nav"
import { hasFacultyAppAccess } from "@/lib/faculty-email"
import type { Profile } from "@/lib/supabase/types"

export function SiteChrome({
  children,
  profile,
}: {
  children: React.ReactNode
  profile: Profile | null
}) {
  const faculty = profile ? hasFacultyAppAccess(profile.role) : false
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <header className="site-header sticky top-0 z-40 bg-[#000D26] text-white">
        <div className="relative grid grid-cols-[1fr_auto] grid-rows-[auto_1fr] items-start gap-x-4 px-4 pb-2">
          <Link
            href={faculty ? "/faculty" : "/student"}
            className="col-start-1 row-start-1 self-start justify-self-start leading-none text-white"
            aria-label="Attendance Tracker"
          >
            <span className="flex flex-col text-[1.35em] font-extrabold leading-[1.05] tracking-tight">
              <span>Attendance</span>
              <span>Tracker</span>
            </span>
          </Link>
          <div className="col-start-2 row-span-2 row-start-1 flex min-h-full flex-col items-end justify-between gap-3 self-stretch">
            {profile ? <SignOutButton /> : <span className="h-7" aria-hidden />}
            <FacultyNav profile={profile} />
          </div>
        </div>
        <div className="h-2.5 bg-[#CE1126]" />
      </header>
      <div className="flex-1 bg-[#F4F6F8]">{children}</div>
    </div>
  )
}
