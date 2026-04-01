"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { CorrectionEntityType } from "@/lib/types"

export async function submitCorrection(data: {
  player_number?: number
  entity_type: CorrectionEntityType
  entity_id: string
  field: string
  current_value: string
  suggested_value: string
}) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase.from("corrections").insert({
    user_id: userId,
    org_id: orgId,
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
