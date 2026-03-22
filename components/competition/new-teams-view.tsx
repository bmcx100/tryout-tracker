"use client"

import { Heart } from "lucide-react"
import type { Player, PinnedPlayer } from "@/lib/types"
import type { Position } from "@/lib/utils"
import { playerName } from "@/lib/utils"

const U15_TEAMS = ["U15AA", "U15A", "U15BB", "U15B", "U15C"]
const SLOTS_PER_TEAM: Record<string, number> = { F: 9, D: 6, G: 2 }

interface NewTeamsViewProps {
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  position: Position
  crewNumbers: Set<number>
}

function formatTeamCode(code: string): string {
  const match = code.match(/^(U\d+)(AA|A|BB|B|C)$/)
  if (!match) return code
  return `${match[1]} ${match[2]}`
}

function buildRankedList(
  players: Player[],
  teamOrder: string[],
  pinnedPlayers: Record<string, PinnedPlayer>,
  playerOrderMap: Record<string, number[]>,
  pos: "F" | "D" | "G"
): Player[] {
  const posPlayers = players.filter((p) => p.position === pos)

  // Build a lookup: player number -> effective team
  const effectiveTeam: Record<number, string> = {}
  for (const p of posPlayers) {
    const pin = pinnedPlayers[String(p.number)]
    effectiveTeam[p.number] = pin ? pin.team : (p.previous_team || "")
  }

  // Group by effective team
  const byTeam: Record<string, Player[]> = {}
  for (const p of posPlayers) {
    const team = effectiveTeam[p.number]
    if (!byTeam[team]) byTeam[team] = []
    byTeam[team].push(p)
  }

  // Sort within each team by custom order or number
  for (const team of Object.keys(byTeam)) {
    const customOrder = playerOrderMap[team]
    if (customOrder?.length) {
      byTeam[team].sort((a, b) => {
        const ai = customOrder.indexOf(a.number)
        const bi = customOrder.indexOf(b.number)
        if (ai === -1 && bi === -1) return a.number - b.number
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    } else {
      byTeam[team].sort((a, b) => a.number - b.number)
    }
  }

  // Flatten in team order
  const ranked: Player[] = []
  for (const team of teamOrder) {
    if (byTeam[team]) {
      ranked.push(...byTeam[team])
    }
  }
  // Add any players whose team isn't in teamOrder
  for (const team of Object.keys(byTeam)) {
    if (!teamOrder.includes(team)) {
      ranked.push(...byTeam[team])
    }
  }

  return ranked
}

export function NewTeamsView({
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  position,
  crewNumbers,
}: NewTeamsViewProps) {
  // Build ranked lists per position
  const rankedF = buildRankedList(players, teamOrder, pinnedPlayers, playerOrderMap, "F")
  const rankedD = buildRankedList(players, teamOrder, pinnedPlayers, playerOrderMap, "D")
  const rankedG = buildRankedList(players, teamOrder, pinnedPlayers, playerOrderMap, "G")

  // Assign to teams: top N go to first team, next N to second, etc.
  const assignments: Record<string, { F: Player[]; D: Player[]; G: Player[] }> = {}
  for (const team of U15_TEAMS) {
    assignments[team] = { F: [], D: [], G: [] }
  }

  for (const pos of ["F", "D", "G"] as const) {
    const ranked = pos === "F" ? rankedF : pos === "D" ? rankedD : rankedG
    const slotsPerTeam = SLOTS_PER_TEAM[pos]
    let idx = 0
    for (const team of U15_TEAMS) {
      const slice = ranked.slice(idx, idx + slotsPerTeam)
      assignments[team][pos] = slice
      idx += slotsPerTeam
    }
  }

  // Which positions to show
  type Pos = "F" | "D" | "G"
  const showPositions: Pos[] = position === "ALL"
    ? ["F", "D", "G"]
    : [position as Pos]

  const posLabels: Record<string, string> = { F: "Forwards", D: "Defense", G: "Goalies" }

  return (
    <div className="comp-new-teams">
      {U15_TEAMS.map((teamCode) => {
        const roster = assignments[teamCode]
        const totalShown = showPositions.reduce((n, p) => n + roster[p].length, 0)
        if (totalShown === 0) return null

        return (
          <div key={teamCode} className="comp-nt-team">
            <div className="comp-nt-header">
              <span className="comp-nt-code">{formatTeamCode(teamCode)}</span>
              <span className="comp-nt-count">
                {totalShown} player{totalShown !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="comp-nt-roster">
              {showPositions.map((pos) => {
                const group = roster[pos]
                if (group.length === 0) return null
                return (
                  <div key={pos} className="comp-nt-group">
                    {position === "ALL" && (
                      <div className="comp-nt-group-label">{posLabels[pos]}</div>
                    )}
                    {group.map((player, idx) => {
                      const pin = pinnedPlayers[String(player.number)]
                      const isPinned = !!pin && player.previous_team !== pin.team
                      const isCrew = crewNumbers.has(player.number)
                      return (
                        <div
                          key={player.number}
                          className={`comp-nt-player${isPinned ? " comp-nt-pinned" : ""}${isCrew ? " comp-nt-crew" : ""}`}
                        >
                          <span className="comp-nt-rank">{idx + 1}</span>
                          <span className="comp-player-number">#{player.number}</span>
                          <span className="comp-player-pos">{player.position}</span>
                          <span className="comp-player-name">
                            {playerName(player.first_name, player.last_name, player.number)}
                          </span>
                          {isCrew && <Heart size={12} className="comp-player-heart" />}
                          {player.previous_team && (
                            <span className="comp-nt-prev-team">{player.previous_team}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
