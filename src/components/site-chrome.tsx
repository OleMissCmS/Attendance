import Link from "next/link"
import { FacultyIdleLogout } from "@/components/faculty-idle-logout"
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
      {faculty ? <FacultyIdleLogout /> : null}
      <header className="site-header sticky top-0 z-40 bg-[#000D26] text-white">
        <div className="relative flex flex-col gap-3 px-4 pb-2">
          <div className="flex justify-end">
            {profile ? <SignOutButton /> : <span className="h-7" aria-hidden />}
          </div>
          <div className="flex items-end justify-between gap-4">
            <Link
              href={faculty ? "/faculty" : "/student"}
              className="leading-none text-white"
              aria-label="Attendance Tracker"
            >
              <span className="flex flex-col text-[1.35em] font-extrabold leading-[1.05] tracking-tight">
                <span>Attendance</span>
                <span>Tracker</span>
              </span>
            </Link>
            <FacultyNav profile={profile} />
          </div>
        </div>
        <div className="h-2.5 bg-[#CE1126]" />
      </header>
      <div className="flex-1 bg-[#F4F6F8]">{children}</div>
    </div>
  )
}
