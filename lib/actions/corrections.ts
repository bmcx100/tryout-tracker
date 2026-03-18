"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { CorrectionEntityType } from "@/lib/types"

export async function submitCorrection(data: {
  player_number?: number
  entity_type: CorrectionEntityType
  entity_id: string
  field: string
  current_value: string
  suggested_value: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase.from("corrections").insert({
    user_id: user.id,
    ...data,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/corrections")
}

export async function resolveCorrection(
  id: string,
  status: "approved" | "rejected",
  adminNotes?: string
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("corrections")
    .update({ status, admin_notes: adminNotes || null })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/corrections")
}
