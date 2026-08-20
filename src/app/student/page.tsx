import { saveStudentEmail } from "@/app/c/actions"
import { SiteChrome } from "@/components/site-chrome"
import { getRememberedEmail } from "@/lib/device"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default async function StudentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const email = await getRememberedEmail()
  const { error, saved } = await searchParams

  return (
    <SiteChrome profile={null}>
      <main className="mx-auto max-w-[36rem] space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-extrabold">Student check-in</h1>
          <p className="text-muted-foreground">
            Save the email on your roster on this phone. When class is live,
            scan the QR code or open the check-in link from your instructor,
            then enter the classroom code.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <form action={saveStudentEmail} className="flex flex-wrap items-end gap-2">
              <div className="min-w-64 flex-1 space-y-1">
                <Label htmlFor="email">School email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={email}
                  placeholder="(e.g. you@go.olemiss.edu)"
                />
              </div>
              <Button type="submit">Save</Button>
            </form>
            {error === "email" ? (
              <p role="alert" className="text-sm text-destructive">
                Enter a valid school email address.
              </p>
            ) : null}
            {saved === "1" && email ? (
              <p role="status" className="text-sm text-emerald-800">
                Saved {email} on this phone. It will be used when you check in.
              </p>
            ) : email && saved !== "1" ? (
              <p className="text-sm text-muted-foreground">
                Currently saved on this phone: {email}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </main>
    </SiteChrome>
  )
}
