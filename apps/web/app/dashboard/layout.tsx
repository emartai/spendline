import type { ReactNode } from "react"

import { DashboardShell } from "../../components/dashboard/dashboard-shell"
import { OnboardingFlow } from "../../components/onboarding/onboarding-flow"
import { createServerClient } from "../../lib/supabase/server"

type DashboardLayoutProps = {
  children: ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userEmail = user?.email ?? "developer@spendline.dev"
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("onboarded")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null }

  return (
    <>
      <DashboardShell userEmail={userEmail}>{children}</DashboardShell>
      <OnboardingFlow initialOnboarded={Boolean(profile?.onboarded)} userEmail={userEmail} />
    </>
  )
}
