"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { createServerClient } from "../../lib/supabase/server"

function getBaseUrl() {
  const headerStore = headers()
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host")
  const protocol = headerStore.get("x-forwarded-proto") ?? "http"

  if (!host) {
    return "http://localhost:3000"
  }

  return `${protocol}://${host}`
}

export async function signInWithGitHub() {
  const supabase = createServerClient()
  const redirectTo = `${getBaseUrl()}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }

  return { error: "Unable to start GitHub sign-in." }
}

export async function signInWithEmail(email: string, password: string) {
  const supabase = createServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = createServerClient()
  const { error } = await supabase.auth.signUp({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect("/dashboard")
}

export async function signOut() {
  const supabase = createServerClient()
  await supabase.auth.signOut()
  redirect("/")
}
