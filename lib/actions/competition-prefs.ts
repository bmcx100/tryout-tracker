"use server"

import { createClient } from "@/lib/supabase/server"
import type { UserCompetitionPrefs } from "@/lib/types"

export async function getCompetitionPrefs(): Promise<UserCompetitionPrefs | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", user.id)
    .single()

  if (error && error.code !== "PGRST116") throw new Error(error.message)
  return data
}

export async function updateTeamOrder(teamOrder: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      team_order: teamOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) throw new Error(error.message)
}

export async function updatePlayerOrder(team: string, playerNumbers: number[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs()
  const playerOrder = existing?.player_order || {}
  playerOrder[team] = playerNumbers

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      player_order: playerOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) throw new Error(error.message)
}

export async function pinPlayer(
  playerNumber: number,
  targetTeam: string,
  position: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs()
  const pinnedPlayers = existing?.pinned_players || {}
  pinnedPlayers[String(playerNumber)] = { team: targetTeam, position }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  if (error) throw new Error(error.message)
}

export async function unpinPlayer(playerNumber: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs()
  if (!existing) return

  const pinnedPlayers = { ...existing.pinned_players }
  delete pinnedPlayers[String(playerNumber)]

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)
}

export async function resetAllPrefs() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .delete()
    .eq("user_id", user.id)

  if (error) throw new Error(error.message)
}
