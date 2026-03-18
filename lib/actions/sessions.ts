"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { PlayerLevel } from "@/lib/types"

export async function createSession(data: {
  level: PlayerLevel
  round_number: number
  group_number: number
  date: string
  start_time: string
  end_time: string
  rink: string
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").insert(data)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/schedule")
}

export async function updateSession(
  id: string,
  data: {
    level?: PlayerLevel
    round_number?: number
    group_number?: number
    date?: string
    start_time?: string
    end_time?: string
    rink?: string
    notes?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sessions")
    .update(data)
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/schedule")
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/schedule")
}

export async function assignPlayersToSession(
  sessionId: string,
  playerNumbers: number[]
) {
  const supabase = await createClient()

  // Remove existing assignments
  await supabase
    .from("session_players")
    .delete()
    .eq("session_id", sessionId)

  // Insert new assignments
  if (playerNumbers.length > 0) {
    const { error } = await supabase.from("session_players").insert(
      playerNumbers.map((num) => ({
        session_id: sessionId,
        player_number: num,
      }))
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath("/admin/sessions")
  revalidatePath("/schedule")
}
