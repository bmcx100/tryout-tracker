"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { PlayerLevel, PlayerStatus } from "@/lib/types"

export async function createPlayer(data: {
  number: number
  first_name?: string
  last_name?: string
  previous_team?: string
  position?: string
  birth_year?: number
  notes?: string
  previous_level?: PlayerLevel
  entry_level?: PlayerLevel
  current_level?: PlayerLevel
}) {
  const supabase = await createClient()
  const { error } = await supabase.from("players").insert({
    ...data,
    status: "active_tryout" as PlayerStatus,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}

export async function updatePlayer(
  id: string,
  data: {
    number?: number
    first_name?: string | null
    last_name?: string | null
    previous_team?: string | null
    position?: string | null
    birth_year?: number | null
    notes?: string | null
    previous_level?: PlayerLevel | null
    entry_level?: PlayerLevel | null
    current_level?: PlayerLevel | null
    status?: PlayerStatus
    team_placed?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("players")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}

export async function deletePlayer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("players").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}

export async function bulkCreatePlayers(
  rows: {
    number: number
    first_name?: string
    last_name?: string
    previous_team?: string
    position?: string
    birth_year?: number
    notes?: string
    previous_level?: PlayerLevel
    entry_level?: PlayerLevel
    current_level?: PlayerLevel
  }[]
) {
  const supabase = await createClient()
  const records = rows.map((row) => ({
    ...row,
    status: "active_tryout" as PlayerStatus,
  }))

  const { data, error } = await supabase.from("players").insert(records).select()
  if (error) throw new Error(error.message)

  revalidatePath("/admin/players")
  return { inserted: data?.length ?? 0 }
}

export async function bulkUpdatePlayerStatus(
  ids: string[],
  status: PlayerStatus,
  currentLevel?: PlayerLevel
) {
  const supabase = await createClient()
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (currentLevel) update.current_level = currentLevel

  const { error } = await supabase
    .from("players")
    .update(update)
    .in("id", ids)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}
