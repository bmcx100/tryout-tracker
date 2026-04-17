"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

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

export async function createOrganization(data: { name: string; slug: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: org, error } = await supabase
    .from("organizations")
    .insert(data)
    .select("id")
    .single()

  if (error) throw new Error(error.message)

  await supabase.from("org_members").insert({
    org_id: org.id,
    user_id: user.id,
    role: "admin",
    approved_at: new Date().toISOString(),
  })

  revalidatePath("/admin/organizations")
}

export async function assignOrgAdmin(orgId: string, userId: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from("org_members")
      .update({ role: "admin", approved_at: new Date().toISOString() })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: userId,
      role: "admin",
      approved_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
  }

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

  revalidatePath("/admin/organizations")
}

export async function switchOrg(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || membership.role === "pending") {
    throw new Error("No active membership in this organization")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_org_id: orgId })
    .eq("id", user.id)

  if (error) throw new Error(error.message)

  revalidatePath("/home")
  revalidatePath("/crew")
  revalidatePath("/players")
  revalidatePath("/current")
}

export async function getUserOrgs() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .neq("role", "pending")

  if (error) throw new Error(error.message)
  return data || []
}

export async function setDefaultOrg(orgId: string) {
  const { supabase } = await requireSuperAdmin()

  // Clear is_default on all orgs
  const { error: clearError } = await supabase
    .from("organizations")
    .update({ is_default: false })
    .neq("id", orgId)

  if (clearError) throw new Error(clearError.message)

  // Set target org as default
  const { error: setError } = await supabase
    .from("organizations")
    .update({ is_default: true })
    .eq("id", orgId)

  if (setError) throw new Error(setError.message)

  revalidatePath("/admin/organizations")
}
