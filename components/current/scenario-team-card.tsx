"use client"

import { useState } from "react"
import { ChevronDown, CheckCircle } from "lucide-react"
import { ScenarioPlayerRow, type ScenarioPlayer } from "./scenario-player-row"
import { getAgeGroup, extractLevelFromTeam, LEVEL_ORDER } from "@/lib/utils"
import type { CrewMember } from "@/lib/types"

function positionGroup(pos: string | null): "D" | "F" | "G" {
  if (!pos) return "F"
  const p = pos.toUpperCase()
  if (p === "D") return "D"
  if (p === "G") return "G"
  return "F"
}

const POS_ORDER: Record<string, number> = { D: 0, F: 1, G: 2 }
const POS_TARGETS: Record<string, number> = { D: 6, F: 9, G: 2 }
const ROSTER_TARGET = 17

export function ScenarioTeamCard({
  teamName,
  roster,
  crewMap,
  availableTeams,
  onMovePlayer,
  onToggleLock,
  onComplete,
  defaultExpanded,
  isComplete,
}: {
  teamName: string
  roster: ScenarioPlayer[]
  crewMap: Map<number, CrewMember>
  availableTeams: string[]
  onMovePlayer: (playerNumber: number, toTeam: string | null) => void
  onToggleLock: (playerNumber: number) => void
  onComplete: () => void
  defaultExpanded?: boolean
  isComplete?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false)

  const teamLevel = extractLevelFromTeam(teamName)
  const teamIdx = teamLevel ? LEVEL_ORDER.indexOf(teamLevel) : 0

  // Rank by origin relative to this team: U15 same level, U15 one below, U13 one above, etc.
  function originRank(sp: ScenarioPlayer): number {
    const ag = getAgeGroup(sp.player.birth_year)
    const prevLevel = extractLevelFromTeam(sp.player.previous_team)
    const pi = prevLevel ? LEVEL_ORDER.indexOf(prevLevel) : 99
    if (ag === "U15") {
      const offset = pi - teamIdx
      if (offset <= 0) return offset // returning or from above — top
      return 2 * offset - 1 // one below = 1, two below = 3, etc.
    }
    // U13
    const offset = pi - teamIdx
    return 2 * (offset + 1) // same level = 2, one below = 4, etc.
  }

  const sorted = [...roster].sort((a, b) => {
    const ga = POS_ORDER[positionGroup(a.player.position)] ?? 1
    const gb = POS_ORDER[positionGroup(b.player.position)] ?? 1
    if (ga !== gb) return ga - gb
    // Locks always at top within position group
    if (a.locked !== b.locked) return a.locked ? -1 : 1
    const ra = originRank(a)
    const rb = originRank(b)
    if (ra !== rb) return ra - rb
    const ta = a.player.previous_team || ""
    const tb = b.player.previous_team || ""
    return ta.localeCompare(tb)
  })

  const posCounts: Record<string, number> = { D: 0, F: 0, G: 0 }
  for (const sp of roster) {
    const g = positionGroup(sp.player.position)
    posCounts[g] = (posCounts[g] || 0) + 1
  }

  const posLocked: Record<string, number> = { D: 0, F: 0, G: 0 }
  for (const sp of roster) {
    if (sp.locked) {
      const g = positionGroup(sp.player.position)
      posLocked[g] = (posLocked[g] || 0) + 1
    }
  }

  const groups: Array<{ label: string; key: string; target: number; count: number; locked: number; players: ScenarioPlayer[] }> = []
  let currentGroup = ""
  for (const sp of sorted) {
    const g = positionGroup(sp.player.position)
    if (g !== currentGroup) {
      currentGroup = g
      const label = g === "D" ? "Defense" : g === "G" ? "Goalies" : "Forwards"
      groups.push({ label, key: g, target: POS_TARGETS[g], count: posCounts[g], locked: posLocked[g], players: [] })
    }
    groups[groups.length - 1].players.push(sp)
  }

  const lockedCount = roster.filter((sp) => sp.locked).length
  const bubbleCount = roster.filter((sp) => sp.bubble).length
  const rosterFull = roster.length >= ROSTER_TARGET

  return (
    <div className="scenario-team-card">
      <button className="scenario-team-header" onClick={() => setExpanded(!expanded)}>
        <div className="scenario-team-title-row">
          <span className="scenario-team-name">{teamName}</span>
          <span className={`scenario-team-count${rosterFull ? " full" : ""}`}>
            {roster.length}/{ROSTER_TARGET}
          </span>
          {lockedCount > 0 && (
            <span className="scenario-team-locked">{lockedCount} locked</span>
          )}
          {bubbleCount > 0 && (
            <span className="scenario-team-bubble">{bubbleCount} bubble</span>
          )}
        </div>
        <ChevronDown className={`team-card-chevron${expanded ? " expanded" : ""}`} />
      </button>
      {expanded && (
        <div className="scenario-team-roster">
          {!isComplete && (
            <button
              className="scenario-complete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onComplete()
              }}
            >
              <CheckCircle className="scenario-complete-icon" />
              Complete — send unlocked down
            </button>
          )}
          {isComplete && (
            <button
              className="scenario-undo-complete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onComplete()
              }}
            >
              <CheckCircle className="scenario-complete-icon" />
              Team Complete — undo
            </button>
          )}
          {roster.length === 0 ? (
            <p className="team-card-empty">No players assigned</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className={`roster-group roster-group-${group.key.toLowerCase()}`}>
                <span className="roster-group-label">
                  {group.label}
                  <span className={`scenario-pos-count${group.locked >= group.target ? " full" : ""}`}>
                    {group.count} Players with {group.locked} Locked
                  </span>
                </span>
                {group.players.map((sp, i) => (
                  <ScenarioPlayerRow
                    key={sp.player.id}
                    showDivider={i > 0 && sp.player.previous_team !== group.players[i - 1].player.previous_team}
                    scenarioPlayer={sp}
                    isInCrew={crewMap.has(sp.player.number)}
                    currentTeam={teamName}
                    availableTeams={availableTeams}
                    onMove={(toTeam) => onMovePlayer(sp.player.number, toTeam)}
                    onToggleLock={() => onToggleLock(sp.player.number)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
