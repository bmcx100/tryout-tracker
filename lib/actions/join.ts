"use server"

import { createClient } from "@/lib/supabase/server"

interface JoinResult {
  preApproved: boolean
  role?: string
  error?: string
  alreadyMember?: boolean
}

export async function joinOrganization(slug: string): Promise<JoinResult> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { preApproved: false, error: "Not authenticated" }

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", slug)
    .single()

  if (!org) return { preApproved: false, error: "Organization not found" }

  // Check existing membership
  const { data: existing } = await supabase
    .from("org_members")
    .select("id, role")
    .eq("org_id", org.id)
    .eq("user_id", user.id)
    .single()

  if (existing) {
    return {
      preApproved: existing.role !== "pending",
      alreadyMember: true,
      role: existing.role,
    }
  }

  // Check if email is pre-approved
  const { data: preApproval } = await supabase
    .from("pre_approved_emails")
    .select("id, role")
    .eq("org_id", org.id)
    .ilike("email", user.email ?? "")
    .single()

  if (preApproval) {
    // Use RPC to bypass RLS and join with approved role
    const { error: rpcError } = await supabase.rpc("join_org_pre_approved", {
      target_org_id: org.id,
      target_role: preApproval.role,
    })

    if (rpcError) {
      return { preApproved: false, error: rpcError.message }
    }

    return { preApproved: true, role: preApproval.role }
  }

  // Normal flow: insert as pending
  const { error: insertError } = await supabase
    .from("org_members")
    .insert({
      org_id: org.id,
      user_id: user.id,
      role: "pending",
    })

  if (insertError) {
    return { preApproved: false, error: insertError.message }
  }

  return { preApproved: false }
}
