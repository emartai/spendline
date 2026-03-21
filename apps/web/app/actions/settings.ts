"use server"

import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

import { createServerClient } from "../../lib/supabase/server"

export async function requestPasswordReset(email: string) {
  const supabase = createServerClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

export async function deleteAccount() {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_KEY for account deletion.")
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  await admin.from("alert_settings").delete().eq("user_id", user.id)
  await admin.from("api_keys").delete().eq("user_id", user.id)
  await admin.from("requests").delete().eq("user_id", user.id)
  await admin.from("profiles").delete().eq("id", user.id)

  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    throw new Error(error.message)
  }

  await supabase.auth.signOut()
  redirect("/")
}
