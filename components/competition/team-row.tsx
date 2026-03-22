"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ChevronDown } from "lucide-react"
import { PlayerList } from "./player-list"
import type { Player, PinnedPlayer } from "@/lib/types"

interface TeamRowProps {
  teamCode: string
  rank: number
  players: Player[]
  pinnedInCount: number
  allPlayers: Player[]
  playerOrder?: number[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  onUnpin?: (playerNumber: number) => void
}

function formatTeamCode(code: string): string {
  const match = code.match(/^(U\d+)(AA|A|BB|B|C)$/)
  if (!match) return code
  return `${match[1]} ${match[2]}`
}

export function TeamRow({
  teamCode,
  rank,
  players,
  pinnedInCount,
  allPlayers,
  playerOrder,
  pinnedPlayers,
  crewNumbers,
  onUnpin,
}: TeamRowProps) {
  const [expanded, setExpanded] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: teamCode })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const nativeCount = players.filter((p) => {
    const pin = pinnedPlayers[String(p.number)]
    return !pin || pin.team === teamCode
  }).length

  const displayCount = nativeCount + pinnedInCount

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`comp-team-row${isDragging ? " comp-team-dragging" : ""}`}
    >
      <button
        className="comp-team-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="comp-team-grip" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </span>
        <span className="comp-team-rank">{rank}</span>
        <span className="comp-team-code">{formatTeamCode(teamCode)}</span>
        <span className="comp-team-count">
          {displayCount} player{displayCount !== 1 ? "s" : ""}
          {pinnedInCount > 0 && (
            <span className="comp-team-pinned-count"> (+{pinnedInCount})</span>
          )}
        </span>
        <span className={`comp-team-chevron${expanded ? " comp-team-chevron-open" : ""}`}>
          <ChevronDown size={16} />
        </span>
      </button>
      {expanded && (
        <div className="comp-team-body">
          <PlayerList
            players={allPlayers}
            teamCode={teamCode}
            playerOrder={playerOrder}
            pinnedPlayers={pinnedPlayers}
            crewNumbers={crewNumbers}
            onUnpin={onUnpin}
          />
        </div>
      )}
    </div>
  )
}
