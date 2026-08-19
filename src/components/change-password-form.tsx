"use client"

import { useState } from "react"
import { changePassword } from "@/app/faculty/account/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ChangePasswordForm() {
  const [status, setStatus] = useState<"idle" | "working" | "error" | "ok">(
    "idle",
  )
  const [message, setMessage] = useState("")

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("working")
    setMessage("")
    const form = event.currentTarget
    const data = new FormData(form)
    const result = await changePassword(data)
    if (result.error) {
      setStatus("error")
      setMessage(result.error)
      return
    }
    form.reset()
    setStatus("ok")
    setMessage("Password updated.")
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="current_password">Current password</Label>
        <Input
          id="current_password"
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new_password">New password</Label>
        <Input
          id="new_password"
          name="new_password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm_password">Confirm new password</Label>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>
      <Button type="submit" disabled={status === "working"}>
        {status === "working" ? "Saving..." : "Update password"}
      </Button>
      {message ? (
        <p
          role="alert"
          className={
            status === "ok"
              ? "text-sm text-muted-foreground"
              : "text-sm text-destructive"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  )
}
