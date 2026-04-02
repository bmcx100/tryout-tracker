"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"

export async function addPreApprovedEmail(email: string, role: "lite" | "full" | "admin") {
  const { orgId, userId } = await getActiveOrgContext()
  const supabase = await createClient()

  const normalized = email.trim().toLowerCase()
  if (!normalized) throw new Error("Email is required")

  const { error } = await supabase
    .from("pre_approved_emails")
    .insert({
      org_id: orgId,
      email: normalized,
      role,
      created_by: userId,
    })

  if (error) {
    if (error.code === "23505") {
      throw new Error("This email is already pre-approved")
    }
    throw new Error(error.message)
  }

  revalidatePath("/admin/users")
}

export async function removePreApprovedEmail(id: string) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("pre_approved_emails")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)

  if (error) throw new Error(error.message)

  revalidatePath("/admin/users")
}
