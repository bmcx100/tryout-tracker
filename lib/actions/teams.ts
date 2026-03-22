"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

type ConfirmField = "info_confirmed" | "checked_in"

export async function togglePlayerConfirmation(
  playerId: string,
  field: ConfirmField,
  value: boolean
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("players")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq("id", playerId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/teams")
}

export async function bulkConfirmTeam(
  playerIds: string[],
  field: ConfirmField,
  value: boolean
) {
  if (playerIds.length === 0) return
  const supabase = await createClient()
  const { error } = await supabase
    .from("players")
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .in("id", playerIds)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/teams")
}
