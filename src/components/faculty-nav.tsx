"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useId, useState } from "react"
import { signOut } from "@/app/faculty/actions"
import { Button } from "@/components/ui/button"
import { hasFacultyAppAccess } from "@/lib/faculty-email"
import type { Profile } from "@/lib/supabase/types"

const navLink =
  "inline-flex min-h-[2.75em] items-end text-[1.125em] font-bold leading-none text-white hover:text-[#A1C6E7] transition-colors"

function linkClass(active: boolean) {
  return `${navLink} ${active ? "text-[#A1C6E7] underline decoration-2 underline-offset-8" : ""}`
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="outline"
        size="xs"
        className="h-7 border-white/30 bg-transparent px-2 text-[0.7em] font-semibold text-white hover:border-[#A1C6E7] hover:bg-transparent hover:text-[#A1C6E7]"
      >
        Sign Out
      </Button>
    </form>
  )
}

export function FacultyNav({
  profile,
}: {
  profile: Profile | null
}) {
  const pathname = usePathname()
  const faculty = profile ? hasFacultyAppAccess(profile.role) : false
  const courseOwner = profile?.role === "faculty"
  const [open, setOpen] = useState(false)
  const menuId = useId()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  const links = faculty
    ? [
        { href: "/faculty", label: "Courses", match: (path: string) => path === "/faculty" },
        {
          href: "/faculty/reports",
          label: "Reports",
          match: (path: string) => path.startsWith("/faculty/reports"),
        },
        {
          href: "/faculty/stats",
          label: "Stats",
          match: (path: string) => path.startsWith("/faculty/stats"),
        },
        ...(courseOwner
          ? [
              {
                href: "/faculty/manage",
                label: "Manage Courses",
                match: (path: string) => path.startsWith("/faculty/manage"),
              },
            ]
          : []),
      ]
    : [
        { href: "/student", label: "My Classes", match: (path: string) => path.startsWith("/student") },
        { href: "/login", label: "Faculty Sign In", match: (path: string) => path.startsWith("/login") },
      ]

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {links.map((link) => {
          const active = link.match(pathname)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={linkClass(active)}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              {link.label}
            </Link>
          )
        })}
      </>
    )
  }

  return (
    <>
      <nav className="hidden items-end gap-8 md:flex">
        <NavLinks />
      </nav>
      <div className="flex items-end md:hidden">
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="h-7 border-white/30 bg-transparent px-2 text-[0.7em] font-semibold text-white hover:border-[#A1C6E7] hover:bg-transparent hover:text-[#A1C6E7]"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          Menu
        </Button>
        {open ? (
          <div
            id={menuId}
            className="absolute inset-x-0 top-full z-50 border-t border-white/10 bg-[#000D26] px-4 py-4 shadow-lg"
          >
            <nav className="flex flex-col gap-2">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        ) : null}
      </div>
    </>
  )
}
