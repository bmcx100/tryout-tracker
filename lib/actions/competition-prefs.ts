"use server"

import { createClient } from "@/lib/supabase/server"
import type { UserCompetitionPrefs, PositionGroup } from "@/lib/types"

export async function getCompetitionPrefs(
  positionGroup: PositionGroup
): Promise<UserCompetitionPrefs | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)
    .single()

  if (error && error.code !== "PGRST116") throw new Error(error.message)
  return data
}

export async function getAllCompetitionPrefs(): Promise<UserCompetitionPrefs[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", user.id)
    .order("last_viewed", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updateTeamOrder(teamOrder: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: "global",
      team_order: teamOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function updatePlayerOrder(
  positionGroup: PositionGroup,
  team: string,
  playerNumbers: number[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  const playerOrder = existing?.player_order || {}
  playerOrder[team] = playerNumbers

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      player_order: playerOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function pinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number,
  targetTeam: string,
  position: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  const pinnedPlayers = existing?.pinned_players || {}
  pinnedPlayers[String(playerNumber)] = { team: targetTeam, position }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function unpinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
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
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function updateTeamSlots(
  positionGroup: PositionGroup,
  teamCode: string,
  slots: Record<string, number> | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  const teamSlots = existing?.team_slots || {}
  if (slots) {
    teamSlots[teamCode] = slots
  } else {
    delete teamSlots[teamCode]
  }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      team_slots: teamSlots,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function markLastViewed(positionGroup: PositionGroup) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      last_viewed: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function resetPrefs(positionGroup: PositionGroup) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .delete()
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

