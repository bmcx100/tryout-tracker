"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
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
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").insert({
    ...data,
    org_id: orgId,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/current")
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
  revalidatePath("/current")
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/current")
}

export async function assignPlayersToSession(
  sessionId: string,
  playerNumbers: number[]
) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  await supabase
    .from("session_players")
    .delete()
    .eq("session_id", sessionId)

  if (playerNumbers.length > 0) {
    const { error } = await supabase.from("session_players").insert(
      playerNumbers.map((num) => ({
        session_id: sessionId,
        player_number: num,
        org_id: orgId,
      }))
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath("/admin/sessions")
  revalidatePath("/current")
}
