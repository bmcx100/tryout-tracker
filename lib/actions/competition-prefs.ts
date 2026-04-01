"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { UserCompetitionPrefs, PositionGroup } from "@/lib/types"

export async function getCompetitionPrefs(
  positionGroup: PositionGroup
): Promise<UserCompetitionPrefs | null> {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)
    .single()

  if (error && error.code !== "PGRST116") throw new Error(error.message)
  return data
}

export async function getAllCompetitionPrefs(): Promise<UserCompetitionPrefs[]> {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("last_viewed", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updateTeamOrder(teamOrder: string[]) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: "global",
      team_order: teamOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function updatePlayerOrder(
  positionGroup: PositionGroup,
  team: string,
  playerNumbers: number[]
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  const playerOrder = existing?.player_order || {}
  playerOrder[team] = playerNumbers

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      player_order: playerOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function pinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number,
  targetTeam: string,
  position: number
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  const pinnedPlayers = existing?.pinned_players || {}
  pinnedPlayers[String(playerNumber)] = { team: targetTeam, position }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function unpinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

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
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function updateTeamSlots(
  positionGroup: PositionGroup,
  teamCode: string,
  slots: Record<string, number> | null
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

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
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      team_slots: teamSlots,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function markLastViewed(positionGroup: PositionGroup) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      last_viewed: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function resetPrefs(positionGroup: PositionGroup) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_competition_prefs")
    .delete()
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function updatePositionOverrides(
  positionGroup: PositionGroup,
  playerNumber: number,
  newPosition: string | null
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  const overrides = existing?.position_overrides || {}
  if (newPosition) {
    overrides[String(playerNumber)] = newPosition
  } else {
    delete overrides[String(playerNumber)]
  }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      position_overrides: overrides,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}
