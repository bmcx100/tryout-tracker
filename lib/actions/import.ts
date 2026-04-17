"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"

export async function confirmImport(players: Array<{ number: number; first_name?: string; last_name?: string }>) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  for (const player of players) {
    const { error } = await supabase.from("players").upsert(
      {
        number: player.number,
        first_name: player.first_name || null,
        last_name: player.last_name || null,
        status: "active_tryout",
        org_id: orgId,
      },
      { onConflict: "org_id,number" }
    )

    if (error) {
      throw new Error(`Failed to import player #${player.number}: ${error.message}`)
    }
  }

  revalidatePath("/admin/players")
  revalidatePath("/players")
}

export async function confirmContinuationsImport(data: {
  level: string
  round_number: number
  sessions: Array<{
    session_number: number
    date: string
    start_time: string
    end_time: string
    player_numbers: number[]
  }>
}) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const allNumbers = data.sessions.flatMap(s => s.player_numbers)
  for (const num of allNumbers) {
    const { error } = await supabase.from("players").upsert(
      {
        number: num,
        status: "active_tryout",
        current_level: data.level,
        org_id: orgId,
      },
      { onConflict: "org_id,number" }
    )
    if (error) {
      throw new Error(`Failed to upsert player #${num}: ${error.message}`)
    }
  }

  for (const session of data.sessions) {
    const { data: sessionRecord, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        level: data.level,
        round_number: data.round_number,
        group_number: session.session_number,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        rink: "",
        org_id: orgId,
      })
      .select("id")
      .single()

    if (sessionError) throw new Error(`Failed to create session: ${sessionError.message}`)

    if (session.player_numbers.length > 0 && sessionRecord) {
      const { error: assignError } = await supabase.from("session_players").insert(
        session.player_numbers.map(num => ({
          session_id: sessionRecord.id,
          player_number: num,
          org_id: orgId,
        }))
      )
      if (assignError) throw new Error(`Failed to assign players: ${assignError.message}`)
    }
  }

  revalidatePath("/admin/players")
  revalidatePath("/admin/sessions")
  revalidatePath("/players")
  revalidatePath("/current")
}
