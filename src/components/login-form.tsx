"use client"

import { useState } from "react"
import { signupErrorMessage } from "@/lib/faculty-email"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle")
  const [message, setMessage] = useState("")

  function nextPath() {
    const next = new URLSearchParams(window.location.search).get("next") ?? "/faculty"
    return next.startsWith("/") && !next.startsWith("//") ? next : "/faculty"
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    setStatus("working")
    setMessage("")
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      setStatus("error")
      setMessage(error.message)
      return
    }
    window.location.assign(nextPath())
  }

  async function createAccount() {
    setStatus("working")
    setMessage("")
    const normalizedEmail = email.trim().toLowerCase()
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    })
    if (error) {
      setStatus("error")
      setMessage(signupErrorMessage(error.message, normalizedEmail))
      return
    }
    const signedIn = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })
    if (signedIn.error) {
      setStatus("error")
      setMessage(
        "Account created. If email confirmation is on in Supabase, confirm it, then sign in.",
      )
      return
    }
    window.location.assign(nextPath())
  }

  return (
    <form onSubmit={signIn} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="(e.g. you@olemiss.edu)"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit" className="w-full" disabled={status === "working"}>
          {status === "working" ? "Signing in..." : "Sign in"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={status === "working"}
          onClick={() => void createAccount()}
        >
          Create faculty account
        </Button>
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </form>
  )
}
