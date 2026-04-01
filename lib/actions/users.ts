"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { UserRole } from "@/lib/types"

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
