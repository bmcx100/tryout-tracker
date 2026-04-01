"use server"

import { createClient } from "@/lib/supabase/server"

export interface OrgContext {
  userId: string
  orgId: string
  role: string
}

export async function getActiveOrgContext(): Promise<OrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .single()

  if (!profile?.active_org_id) throw new Error("No active organization")

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", profile.active_org_id)
    .eq("user_id", user.id)
    .single()

  if (!membership) throw new Error("Not a member of active organization")

  return {
    userId: user.id,
    orgId: profile.active_org_id,
    role: membership.role,
  }
}
