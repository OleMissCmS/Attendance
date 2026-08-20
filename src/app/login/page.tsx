import { LoginForm } from "@/components/login-form"
import { SiteChrome } from "@/components/site-chrome"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getProfile } from "@/lib/auth"
import { hasFacultyAppAccess } from "@/lib/faculty-email"
import { ACCOUNT_LOCKED_MESSAGE } from "@/lib/login-lock"
import { redirect } from "next/navigation"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const profile = await getProfile()
  const { error, next } = await searchParams
  if (profile) {
    if (next?.startsWith("/") && !next.startsWith("//")) redirect(next)
    redirect(hasFacultyAppAccess(profile.role) ? "/faculty" : "/student")
  }

  return (
    <SiteChrome profile={null}>
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-[24rem]">
          <CardHeader>
            <CardTitle className="text-2xl font-extrabold">
              Faculty sign in
            </CardTitle>
            <CardDescription>
              Sign in with email and password. Students check in from My
              classes or a QR code — they do not create accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error === "locked" ? (
              <p className="text-sm text-destructive">
                {ACCOUNT_LOCKED_MESSAGE}
              </p>
            ) : error === "idle" ? (
              <p className="text-sm text-destructive">
                You were signed out after 5 hours without activity.
              </p>
            ) : error ? (
              <p className="text-sm text-destructive">
                Sign-in failed. Check your email and password.
              </p>
            ) : null}
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </SiteChrome>
  )
}
