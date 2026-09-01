import Link from "next/link"
import { signOut } from "@/app/faculty/actions"
import { Button } from "@/components/ui/button"
import { hasFacultyAppAccess } from "@/lib/faculty-email"
import type { Profile } from "@/lib/supabase/types"

export function AppHeader({
  profile,
  homeHref,
}: {
  profile: Profile
  homeHref: string
}) {
  return (
    <header className="border-b border-primary/15 bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href={homeHref} className="text-lg font-extrabold tracking-tight">
            Attendance
          </Link>
          {hasFacultyAppAccess(profile.role) ? (
            <nav className="flex gap-4 text-sm text-primary-foreground/80">
              <Link href="/faculty" className="hover:text-primary-foreground">
                Courses
              </Link>
              <Link href="/faculty/reports" className="hover:text-primary-foreground">
                Reports
              </Link>
              <Link href="/faculty/stats" className="hover:text-primary-foreground">
                My Analytics
              </Link>
            </nav>
          ) : (
            <nav className="flex gap-4 text-sm text-primary-foreground/80">
              <Link href="/student" className="hover:text-primary-foreground">
                Student
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-primary-foreground/80 sm:inline">
            {profile.email}
          </span>
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
