"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { UserRole } from "@/lib/types"

export async function approveUser(userId: string, role: "lite" | "full") {
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({
      role,
      approved_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/users")
}

export async function updateUserRole(userId: string, role: UserRole) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/users")
}
