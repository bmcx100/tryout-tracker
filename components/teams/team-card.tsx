"use client"

import { useState } from "react"
import { ChevronDown, Heart } from "lucide-react"
import { RosterRow } from "@/components/teams/roster-row"
import { addToCrew, removeFromCrew } from "@/lib/actions/crew"
import { toast } from "sonner"
import { playerName } from "@/lib/utils"
import type { Player, CrewMember } from "@/lib/types"

function positionGroup(pos: string | null): "D" | "F" | "G" {
  if (!pos) return "F"
  const p = pos.toUpperCase()
  if (p === "D") return "D"
  if (p === "G") return "G"
  return "F"
}

const POS_ORDER: Record<string, number> = { D: 0, F: 1, G: 2 }

function getPlayerName(p: Player): string {
  return playerName(p.first_name, p.last_name, p.number)
}

export function TeamCard({
  teamName,
  players,
  crewMap,
  onCrewChanged,
}: {
  teamName: string
  players: Player[]
  crewMap: Map<number, CrewMember>
  onCrewChanged: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const sorted = [...players].sort((a, b) => {
    const ga = POS_ORDER[positionGroup(a.position)] ?? 1
    const gb = POS_ORDER[positionGroup(b.position)] ?? 1
    return ga - gb
  })

  // Group into D / F / G sections
  const groups: Array<{ label: string; key: string; players: Player[] }> = []
  let currentGroup = ""
  for (const p of sorted) {
    const g = positionGroup(p.position)
    if (g !== currentGroup) {
      currentGroup = g
      const label = g === "D" ? "Defense" : g === "G" ? "Goalies" : "Forwards"
      groups.push({ label, key: g, players: [] })
    }
    groups[groups.length - 1].players.push(p)
  }

  const allInCrew = players.length > 0 && players.every((p) => crewMap.has(p.number))
  const notInCrew = players.filter((p) => !crewMap.has(p.number))

  const handleAddAll = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (notInCrew.length === 0) return
    try {
      for (const p of notInCrew) {
        await addToCrew({
          player_number: p.number,
          personal_name: getPlayerName(p),
          tag: "friend",
        })
      }
      toast.success(`Added ${notInCrew.length} players to your crew`)
      onCrewChanged()
    } catch {
      toast.error("Failed to add players")
    }
  }

  const handleAddOne = async (player: Player) => {
    try {
      await addToCrew({
        player_number: player.number,
        personal_name: getPlayerName(player),
        tag: "friend",
      })
      toast.success(`Added ${getPlayerName(player)} to your crew`)
      onCrewChanged()
    } catch {
      toast.error("Failed to add to crew")
    }
  }

  const handleRemoveOne = async (player: Player) => {
    const member = crewMap.get(player.number)
    if (!member) return
    try {
      await removeFromCrew(member.id)
      toast.success(`Removed ${getPlayerName(player)} from your crew`)
      onCrewChanged()
    } catch {
      toast.error("Failed to remove from crew")
    }
  }

  return (
    <div className="team-card">
      <button
        className="team-card-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="team-card-title-row">
          <span className="team-card-name">{teamName}</span>
          <span className="team-card-count">
            {players.length} Players
            <span className="team-card-pos-divider" />
            <span className="team-card-pos-counts">
              <span className="team-card-pos-item">{players.filter((p) => positionGroup(p.position) === "D").length} D</span>
              <span className="team-card-pos-divider" />
              <span className="team-card-pos-item">{players.filter((p) => positionGroup(p.position) === "F").length} F</span>
              <span className="team-card-pos-divider" />
              <span className="team-card-pos-item">{players.filter((p) => positionGroup(p.position) === "G").length} G</span>
            </span>
          </span>
        </div>
        <div className="team-card-actions">
          <span
            className={`crew-heart crew-heart-team${allInCrew ? " active" : ""}`}
            onClick={allInCrew ? undefined : handleAddAll}
            role="button"
          >
            <Heart className="crew-heart-icon" />
          </span>
          <ChevronDown className={`team-card-chevron${expanded ? " expanded" : ""}`} />
        </div>
      </button>
      {expanded && (
        <div className="team-card-roster">
          {players.length === 0 ? (
            <p className="team-card-empty">No players listed</p>
          ) : (
            groups.map((group) => (
              <div key={group.key} className={`roster-group roster-group-${group.key.toLowerCase()}`}>
                <span className="roster-group-label">{group.label}</span>
                {group.players.map((player) => {
                  const isInCrew = crewMap.has(player.number)
                  return (
                    <RosterRow
                      key={player.id}
                      player={player}
                      isInCrew={isInCrew}
                      onAddToCrew={() => handleAddOne(player)}
                      onRemoveFromCrew={() => handleRemoveOne(player)}
                    />
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
