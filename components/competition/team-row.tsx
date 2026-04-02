"use client"

import { useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ChevronDown, Hand } from "lucide-react"
import { PlayerList } from "./player-list"
import type { Player, PinnedPlayer } from "@/lib/types"

interface TeamRowProps {
  teamCode: string
  rank: number
  playerCount: number
  allPlayers: Player[]
  playerOrder?: number[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  positionFilter?: "F" | "D" | "G" | "ALL"
  positionOverrides?: Record<string, string>
  onLongPressPosition?: (player: Player) => void
  isLowerAge?: boolean
  mode?: "teams" | "players"
  demoExpanded?: boolean
  demoHint?: { high: number; low: number; shift: number }
  demoShift?: "a" | "b"
  demoShiftAmount?: number
}

function formatTeamCode(code: string): string {
  const match = code.match(/^(U\d+)(AA|A|BB|B|C)$/)
  if (!match) return code
  return `${match[1]} ${match[2]}`
}

export function TeamRow({
  teamCode,
  rank,
  playerCount,
  allPlayers,
  playerOrder,
  pinnedPlayers,
  crewNumbers,
  positionFilter,
  positionOverrides,
  onLongPressPosition,
  isLowerAge,
  mode,
  demoExpanded,
  demoHint,
  demoShift,
  demoShiftAmount,
}: TeamRowProps) {
  const [expanded, setExpanded] = useState(false)
  const isExpanded = expanded || demoExpanded
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: teamCode, disabled: mode === "players" })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(demoHint ? {
      "--demo-high": `${demoHint.high}px`,
      "--demo-low": `${demoHint.low}px`,
    } as React.CSSProperties : {}),
    ...(demoShiftAmount ? {
      "--demo-shift": `${demoShiftAmount}px`,
    } as React.CSSProperties : {}),
  }

  const cls = [
    "comp-team-row",
    isLowerAge && "comp-team-lower-age",
    isDragging && "comp-team-dragging",
    demoHint && "comp-team-demo",
    demoShift === "a" && "comp-team-shift-a",
    demoShift === "b" && "comp-team-shift-b",
  ].filter(Boolean).join(" ")

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cls}
      data-team={teamCode}
    >
      <button
        className="comp-team-header"
        data-team-header={teamCode}
        onClick={() => mode !== "teams" && setExpanded(!expanded)}
        {...(mode !== "players" ? { ...attributes, ...listeners } : {})}
      >
        {mode !== "players" && (
          <span className="comp-team-grip">
            <GripVertical size={16} />
          </span>
        )}
        <span className="comp-team-rank">{rank}</span>
        <span className="comp-team-code">{formatTeamCode(teamCode)}</span>
        <span className="comp-team-count">
          {playerCount} player{playerCount !== 1 ? "s" : ""}
        </span>
        {mode !== "teams" && (
          <span className={`comp-team-chevron${isExpanded ? " comp-team-chevron-open" : ""}`}>
            <ChevronDown size={16} />
          </span>
        )}
      </button>
      {mode !== "teams" && isExpanded && (
        <div className="comp-team-body">
          <PlayerList
            players={allPlayers}
            teamCode={teamCode}
            playerOrder={playerOrder}
            pinnedPlayers={pinnedPlayers}
            crewNumbers={crewNumbers}
            positionFilter={positionFilter}
            positionOverrides={positionOverrides}
            onLongPressPosition={onLongPressPosition}
          />
        </div>
      )}
      {demoHint && (
        <>
          <span className="comp-demo-hand"><Hand size={28} /></span>
          <span className="comp-demo-label">Where would you rank this team?</span>
        </>
      )}
    </div>
  )
}
