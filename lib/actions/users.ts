"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { UserRole } from "@/lib/types"

async function requireSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single()
  if (!profile?.is_super_admin) throw new Error("Super admin access required")
  return { supabase, userId: user.id }
}

export async function approveUser(userId: string, role: "lite" | "full") {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("org_members")
    .update({
      role,
      approved_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("user_id", userId)

  if (error) throw new Error(error.message)

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single()

  if (profile && !profile.active_org_id) {
    await supabase
      .from("profiles")
      .update({ active_org_id: orgId })
      .eq("id", userId)
  }

  revalidatePath("/admin/users")
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/users")
}

export async function reassignUserOrg(userId: string, newOrgId: string) {
  const { supabase } = await requireSuperAdmin()

  // Get user's current membership via their active_org_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single()

  if (!profile) throw new Error("User profile not found")

  const oldOrgId = profile.active_org_id

  // Get current membership details to preserve role/approved_at
  let role = "pending"
  let approvedAt: string | null = null

  if (oldOrgId) {
    const { data: oldMembership } = await supabase
      .from("org_members")
      .select("role, approved_at")
      .eq("org_id", oldOrgId)
      .eq("user_id", userId)
      .single()

    if (oldMembership) {
      role = oldMembership.role
      approvedAt = oldMembership.approved_at

      // Delete old membership
      const { error: deleteError } = await supabase
        .from("org_members")
        .delete()
        .eq("org_id", oldOrgId)
        .eq("user_id", userId)

      if (deleteError) throw new Error(deleteError.message)
    }
  }

  // Insert new membership
  const { error: insertError } = await supabase
    .from("org_members")
    .insert({
      org_id: newOrgId,
      user_id: userId,
      role,
      approved_at: approvedAt,
    })

  if (insertError) throw new Error(insertError.message)

  // Update active_org_id
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ active_org_id: newOrgId })
    .eq("id", userId)

  if (updateError) throw new Error(updateError.message)

  revalidatePath("/admin/users")
}
