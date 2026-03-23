"use server"

import { redirect } from "next/navigation"

import { createServerClient } from "../../lib/supabase/server"

function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL

  if (!apiUrl) {
    throw new Error("Missing NEXT_PUBLIC_API_URL.")
  }

  return apiUrl.replace(/\/$/, "")
}

async function getAuthenticatedContext() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token || !session.user) {
    redirect("/")
  }

  return { supabase, accessToken: session.access_token }
}

export async function requestPasswordReset(email: string) {
  const supabase = createServerClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function deleteAllData() {
  const { accessToken } = await getAuthenticatedContext()
  const response = await fetch(`${getApiUrl()}/v1/account/data`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Unable to delete account data.")
  }

  redirect("/dashboard")
}

export async function deleteAccount() {
  const { supabase, accessToken } = await getAuthenticatedContext()
  const response = await fetch(`${getApiUrl()}/v1/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Unable to delete account.")
  }

  await supabase.auth.signOut()
  redirect("/")
}
