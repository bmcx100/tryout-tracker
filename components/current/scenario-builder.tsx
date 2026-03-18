"use client"

import { useMemo, useState, useRef } from "react"
import { RotateCcw } from "lucide-react"
import { ScenarioTeamCard } from "./scenario-team-card"
import { ScenarioPlayerRow, type ScenarioPlayer } from "./scenario-player-row"
import { getAgeGroup, LEVEL_ORDER, extractLevelFromTeam } from "@/lib/utils"
import type { Player, CrewMember } from "@/lib/types"
import type { PlayerLevel } from "@/lib/utils"

interface ScenarioTeam {
  teamName: string
  level: PlayerLevel
  roster: ScenarioPlayer[]
}

/**
 * Build scenario rosters for all U15 teams.
 *
 * Rules:
 * - U15 players: LOCK at their own previous level. BUBBLE one level up. Cannot fall below previous level.
 * - U13 players: BUBBLE at same level and one level down. LOCK two levels down.
 *
 * For each target team U15{level} at index ti:
 *   1. LOCK — U15 returning: previous_team = U15{level}
 *   2. LOCK — U13 floor: U13 players whose level index = ti - 2 (two levels down = lock)
 *   3. BUBBLE — U15 from one below: previous_team = U15{level at ti+1} (trying to move up)
 *   4. BUBBLE — U13 same level: U13 players whose level index = ti
 *   5. BUBBLE — U13 one above: U13 players whose level index = ti - 1 (one level down for them)
 *
 * Processed top-down (AA first) so higher teams claim players first.
 */
function buildScenario(players: Player[]): { teams: ScenarioTeam[]; unassigned: Player[] } {
  // Include all players that aren't placed or withdrawn
  const eligible = players.filter((p) => {
    if (p.status === "placed_on_team" || p.status === "withdrawn") return false
    return true
  })

  // Categorize each player by their origin
  const u15ByLevel = new Map<number, Player[]>() // level index → players
  const u13ByLevel = new Map<number, Player[]>()
  const noLevel: Player[] = []

  for (const p of eligible) {
    const ag = getAgeGroup(p.birth_year)
    const level = extractLevelFromTeam(p.previous_team)
    if (!level) {
      noLevel.push(p)
      continue
    }
    const li = LEVEL_ORDER.indexOf(level)
    if (li < 0) {
      noLevel.push(p)
      continue
    }
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

    // 1. LOCK — U15 returning at this level
    for (const p of u15ByLevel.get(ti) || []) {
      if (assigned.has(p.number)) continue
      roster.push({ player: p, locked: true, source: "returning", bubble: false })
      assigned.add(p.number)
    }

    // 2. LOCK — U13 players two levels above this target (two levels down for them = lock)
    if (ti >= 2) {
      for (const p of u13ByLevel.get(ti - 2) || []) {
        if (assigned.has(p.number)) continue
        roster.push({ player: p, locked: true, source: "age_up", bubble: false })
        assigned.add(p.number)
      }
    }

    // 3. BUBBLE — U15 from one level below trying to move up
    if (ti + 1 < LEVEL_ORDER.length) {
      for (const p of u15ByLevel.get(ti + 1) || []) {
        if (assigned.has(p.number)) continue
        roster.push({ player: p, locked: false, source: "level_below", bubble: true })
        assigned.add(p.number)
      }
    }

    // 4. BUBBLE — U13 at same level (same level = bubble)
    for (const p of u13ByLevel.get(ti) || []) {
      if (assigned.has(p.number)) continue
      roster.push({ player: p, locked: false, source: "age_up", bubble: true })
      assigned.add(p.number)
    }

    // 5. BUBBLE — U13 one level above this target (one level down for them = bubble)
    if (ti >= 1) {
      for (const p of u13ByLevel.get(ti - 1) || []) {
        if (assigned.has(p.number)) continue
        roster.push({ player: p, locked: false, source: "age_up", bubble: true })
        assigned.add(p.number)
      }
    }

    teams.push({ teamName, level, roster })
  }

  const unassigned = [...noLevel, ...eligible.filter((p) => !assigned.has(p.number) && !noLevel.includes(p))]
  return { teams, unassigned }
}

/**
 * Determine lock status when a player is moved to a new team.
 * - U15 player moved to their own previous level or below → lock
 * - U13 player moved two+ levels below their previous level → lock
 * - Otherwise → unlocked (bubble)
 */
function shouldLockOnMove(player: Player, targetLevel: PlayerLevel): boolean {
  const prevLevel = extractLevelFromTeam(player.previous_team)
  if (!prevLevel) return false
  const prevIdx = LEVEL_ORDER.indexOf(prevLevel)
  const targetIdx = LEVEL_ORDER.indexOf(targetLevel)
  if (prevIdx < 0 || targetIdx < 0) return false

  const ag = getAgeGroup(player.birth_year)
  if (ag === "U15") {
    // U15 players lock at their own level or below (but shouldn't go below)
    return targetIdx >= prevIdx
  } else if (ag === "U13") {
    // U13 players lock two levels down or more
    return targetIdx >= prevIdx + 2
  }
  return false
}

export function ScenarioBuilder({
  players,
  crewMap,
}: {
  players: Player[]
  crewMap: Map<number, CrewMember>
}) {
  const [generation, setGeneration] = useState(0)
  const hasManualChanges = useRef(false)

  const initial = useMemo(() => {
    return buildScenario(players)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, generation])

  const [teams, setTeams] = useState<ScenarioTeam[]>(initial.teams)
  const [unassigned, setUnassigned] = useState<Player[]>(initial.unassigned)

  const prevGenRef = useRef({ players, generation })
  if (
    prevGenRef.current.players !== players ||
    prevGenRef.current.generation !== generation
  ) {
    prevGenRef.current = { players, generation }
    setTeams(initial.teams)
    setUnassigned(initial.unassigned)
    hasManualChanges.current = false
  }

  const handleReset = () => {
    if (hasManualChanges.current) {
      if (!window.confirm("Reset will discard your changes. Continue?")) return
    }
    setGeneration((g) => g + 1)
  }

  const availableTeams = teams.map((t) => t.teamName)

  const handleMovePlayer = (playerNumber: number, fromTeam: string | null, toTeam: string | null) => {
    hasManualChanges.current = true
    setTeams((prev) => {
      const next = prev.map((t) => ({ ...t, roster: [...t.roster] }))

      let movedPlayer: ScenarioPlayer | null = null
      if (fromTeam) {
        const sourceTeam = next.find((t) => t.teamName === fromTeam)
        if (sourceTeam) {
          const idx = sourceTeam.roster.findIndex((sp) => sp.player.number === playerNumber)
          if (idx >= 0) {
            movedPlayer = { ...sourceTeam.roster[idx], source: "manual" }
            sourceTeam.roster.splice(idx, 1)
          }
        }
      } else {
        const player = unassigned.find((p) => p.number === playerNumber)
        if (player) {
          movedPlayer = { player, locked: false, source: "manual", bubble: false }
          setUnassigned((prev) => prev.filter((p) => p.number !== playerNumber))
        }
      }

      if (movedPlayer && toTeam) {
        const destTeam = next.find((t) => t.teamName === toTeam)
        if (destTeam) {
          const locked = shouldLockOnMove(movedPlayer.player, destTeam.level)
          destTeam.roster.push({
            ...movedPlayer,
            locked,
            bubble: !locked,
          })
        }
      } else if (movedPlayer && !toTeam) {
        setUnassigned((prev) => [...prev, movedPlayer!.player])
      }

      return next
    })
  }

  const handleToggleLock = (playerNumber: number, teamName: string) => {
    hasManualChanges.current = true
    setTeams((prev) =>
      prev.map((t) => {
        if (t.teamName !== teamName) return t
        return {
          ...t,
          roster: t.roster.map((sp) =>
            sp.player.number === playerNumber ? { ...sp, locked: !sp.locked } : sp
          ),
        }
      })
    )
  }

  return (
    <div className="scenario-builder">
      <div className="scenario-actions">
        <button className="scenario-reset-btn" onClick={handleReset}>
          <RotateCcw className="scenario-reset-icon" />
          Reset
        </button>
      </div>

      <div className="scenario-teams">
        {teams.map((team) => (
          <ScenarioTeamCard
            key={team.teamName}
            teamName={team.teamName}
            roster={team.roster}
            crewMap={crewMap}
            availableTeams={availableTeams}
            onMovePlayer={(playerNumber, toTeam) =>
              handleMovePlayer(playerNumber, team.teamName, toTeam)
            }
            onToggleLock={(playerNumber) => handleToggleLock(playerNumber, team.teamName)}
            defaultExpanded={team.level === "AA"}
          />
        ))}
      </div>

      {unassigned.length > 0 && (
        <div className="scenario-unassigned">
          <h3 className="scenario-unassigned-title">
            Unassigned ({unassigned.length})
          </h3>
          <div className="scenario-unassigned-list">
            {unassigned.map((player) => (
              <ScenarioPlayerRow
                key={player.id}
                scenarioPlayer={{ player, locked: false, source: "manual", bubble: false }}
                isInCrew={crewMap.has(player.number)}
                currentTeam={null}
                availableTeams={availableTeams}
                onMove={(toTeam) => {
                  if (toTeam) {
                    handleMovePlayer(player.number, null, toTeam)
                  }
                }}
                onToggleLock={() => {}}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
