"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { PlayerLevel, RoundResult } from "@/lib/types"

export async function createRound(data: {
  level: PlayerLevel
  round_number: number
  date: string
  notes?: string
}) {
  const supabase = await createClient()
  const { error } = await supabase.from("rounds").insert(data)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/rounds")
}

export async function recordRoundResults(
  roundId: string,
  results: Array<{
    player_number: number
    result: RoundResult
    notes?: string
  }>
) {
  const supabase = await createClient()

  // Insert results
  const { error: resultError } = await supabase.from("round_results").insert(
    results.map((r) => ({
      round_id: roundId,
      player_number: r.player_number,
      result: r.result,
      notes: r.notes,
    }))
  )

  if (resultError) throw new Error(resultError.message)

  // Cascade status updates
  const { data: round } = await supabase
    .from("rounds")
    .select("level")
    .eq("id", roundId)
    .single()

  if (!round) return

  const levels: PlayerLevel[] = ["AA", "A", "BB", "B", "C"]
  const currentIdx = levels.indexOf(round.level as PlayerLevel)

  for (const r of results) {
    if (r.result === "cut_down" && currentIdx < levels.length - 1) {
      await supabase
        .from("players")
        .update({
          status: "cut_to_next_level",
          current_level: levels[currentIdx + 1],
          updated_at: new Date().toISOString(),
        })
        .eq("number", r.player_number)
    } else if (r.result === "placed") {
      await supabase
        .from("players")
        .update({
          status: "placed_on_team",
          updated_at: new Date().toISOString(),
        })
        .eq("number", r.player_number)
    } else if (r.result === "withdrawn") {
      await supabase
        .from("players")
        .update({
          status: "withdrawn",
          updated_at: new Date().toISOString(),
        })
        .eq("number", r.player_number)
    }
  }

  revalidatePath("/admin/rounds")
  revalidatePath("/crew")
  revalidatePath("/feed")
}
