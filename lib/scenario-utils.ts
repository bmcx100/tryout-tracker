import { getAgeGroup, LEVEL_ORDER, extractLevelFromTeam } from "@/lib/utils"
import type { Player, ScenarioDataPayload } from "@/lib/types"
import type { PlayerLevel } from "@/lib/utils"
import type { ScenarioPlayer } from "@/components/current/scenario-player-row"

export interface ScenarioTeam {
  teamName: string
  level: PlayerLevel
  roster: ScenarioPlayer[]
}

/**
 * Build scenario rosters for all U15 teams.
 *
 * For each target team U15{level} at index ti:
 *   1. LOCK — U15 returning: previous_team = U15{level}
 *   2. BUBBLE — U13 one level above (one down for them)
 *   3. BUBBLE — U15 from one level below
 *   4. BUBBLE — U13 at same level
 *   5. LOCK — U13 two levels above (two down for them = lock)
 */
export function buildScenario(players: Player[]): { teams: ScenarioTeam[]; unassigned: Player[] } {
  const eligible = players.filter((p) =>
    p.status !== "placed_on_team" && p.status !== "withdrawn"
  )

  const u15ByLevel = new Map<number, Player[]>()
  const u13ByLevel = new Map<number, Player[]>()
  const noLevel: Player[] = []

  for (const p of eligible) {
    const ag = getAgeGroup(p.birth_year)
    const level = extractLevelFromTeam(p.previous_team)
    if (!level) { noLevel.push(p); continue }
    const li = LEVEL_ORDER.indexOf(level)
    if (li < 0) { noLevel.push(p); continue }
    if (ag === "U15") {
      const arr = u15ByLevel.get(li) || []
      arr.push(p)
      u15ByLevel.set(li, arr)
    } else if (ag === "U13") {
      const arr = u13ByLevel.get(li) || []
      arr.push(p)
      u13ByLevel.set(li, arr)
    } else {
      noLevel.push(p)
    }
  }

  const assigned = new Set<number>()
  const teams: ScenarioTeam[] = []

  for (let ti = 0; ti < LEVEL_ORDER.length; ti++) {
    const level = LEVEL_ORDER[ti]
    const teamName = `U15${level}`
    const roster: ScenarioPlayer[] = []
    let pri = 0

    for (const p of u15ByLevel.get(ti) || []) {
      if (assigned.has(p.number)) continue
      roster.push({ player: p, locked: true, source: "returning", bubble: false, priority: pri })
      assigned.add(p.number)
    }
    pri++

    if (ti >= 1) {
      for (const p of u13ByLevel.get(ti - 1) || []) {
        if (assigned.has(p.number)) continue
        roster.push({ player: p, locked: false, source: "age_up", bubble: true, priority: pri })
        assigned.add(p.number)
      }
    }
    pri++

    if (ti + 1 < LEVEL_ORDER.length) {
      for (const p of u15ByLevel.get(ti + 1) || []) {
        if (assigned.has(p.number)) continue
        roster.push({ player: p, locked: false, source: "level_below", bubble: true, priority: pri })
        assigned.add(p.number)
      }
    }
    pri++

    for (const p of u13ByLevel.get(ti) || []) {
      if (assigned.has(p.number)) continue
      roster.push({ player: p, locked: false, source: "age_up", bubble: true, priority: pri })
      assigned.add(p.number)
    }
    pri++

    if (ti >= 2) {
      for (const p of u13ByLevel.get(ti - 2) || []) {
        if (assigned.has(p.number)) continue
        roster.push({ player: p, locked: true, source: "age_up", bubble: false, priority: pri })
        assigned.add(p.number)
      }
    }

    teams.push({ teamName, level, roster })
  }

  const unassigned = [...noLevel, ...eligible.filter((p) => !assigned.has(p.number) && !noLevel.includes(p))]
  return { teams, unassigned }
}

/**
 * Example 1: same as Fresh Build — a starting point users can modify.
 */
export function buildExample1Scenario(players: Player[]): { teams: ScenarioTeam[]; unassigned: Player[] } {
  return buildScenario(players)
}

/**
 * Determine lock status when a player is moved to a new team.
 */
export function shouldLockOnMove(player: Player, targetLevel: PlayerLevel): boolean {
  const prevLevel = extractLevelFromTeam(player.previous_team)
  if (!prevLevel) return false
  const prevIdx = LEVEL_ORDER.indexOf(prevLevel)
  const targetIdx = LEVEL_ORDER.indexOf(targetLevel)
  if (prevIdx < 0 || targetIdx < 0) return false

  const ag = getAgeGroup(player.birth_year)
  if (ag === "U15") return targetIdx >= prevIdx
  if (ag === "U13") return targetIdx >= prevIdx + 2
  return false
}

/**
 * Serialize component state → compact JSONB payload (no full Player objects).
 */
export function serializeScenario(
  teams: ScenarioTeam[],
  unassigned: Player[],
  completedTeams: Set<string>,
): ScenarioDataPayload {
  return {
    version: 1,
    teams: teams.map((t) => ({
      teamName: t.teamName,
      level: t.level,
      roster: t.roster.map((sp) => ({
        player_number: sp.player.number,
        locked: sp.locked,
        source: sp.source,
        bubble: sp.bubble,
        priority: sp.priority,
      })),
    })),
    unassigned: unassigned.map((p) => p.number),
    completedTeams: Array.from(completedTeams),
  }
}

/**
 * Rehydrate JSONB payload + fresh player data → component state.
 * Players that no longer exist or are placed/withdrawn are silently dropped.
 */
export function rehydrateScenario(
  data: ScenarioDataPayload,
  players: Player[],
): { teams: ScenarioTeam[]; unassigned: Player[]; completedTeams: Set<string> } {
  const playerMap = new Map(players.map((p) => [p.number, p]))

  const teams: ScenarioTeam[] = data.teams.map((td) => ({
    teamName: td.teamName,
    level: td.level as PlayerLevel,
    roster: td.roster
      .filter((sp) => {
        const player = playerMap.get(sp.player_number)
        return player && player.status !== "placed_on_team" && player.status !== "withdrawn"
      })
      .map((sp) => ({
        player: playerMap.get(sp.player_number)!,
        locked: sp.locked,
        source: sp.source,
        bubble: sp.bubble,
        priority: sp.priority,
      })),
  }))

  const unassigned = data.unassigned
    .map((num) => playerMap.get(num))
    .filter((p): p is Player => !!p && p.status !== "placed_on_team" && p.status !== "withdrawn")

  return {
    teams,
    unassigned,
    completedTeams: new Set(data.completedTeams),
  }
}
