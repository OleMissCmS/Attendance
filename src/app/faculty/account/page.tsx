import { ChangePasswordForm } from "@/components/change-password-form"
import { SiteChrome } from "@/components/site-chrome"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireFaculty } from "@/lib/auth"

export default async function AccountSettingsPage() {
  const profile = await requireFaculty()

  return (
    <SiteChrome profile={profile}>
      <main className="mx-auto max-w-[50rem] space-y-6 px-4 py-8">
        <h1 className="text-2xl font-extrabold">Account settings</h1>
        <p className="text-muted-foreground">
          Signed in as {profile.email}
          {profile.role === "advisor" ? " (advisor, view-only)" : ""}. Change
          your own password below. You cannot change other users&apos; accounts.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Enter your current password, then choose a new password of at
              least 6 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </main>
    </SiteChrome>
  )
}
