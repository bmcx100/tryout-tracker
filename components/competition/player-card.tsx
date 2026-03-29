"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Heart } from "lucide-react"
import type { Player } from "@/lib/types"
import { playerName } from "@/lib/utils"

interface PlayerCardProps {
  player: Player
  isCrew?: boolean
  isDefense?: boolean
  showDivider?: boolean
}

export function PlayerCard({
  player,
  isCrew,
  isDefense,
  showDivider,
}: PlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `p-${player.number}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const name = playerName(player.first_name, player.last_name, player.number)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`comp-player-card${isDragging ? " comp-player-dragging" : ""}${isDefense ? " comp-player-defense" : ""}${showDivider ? " comp-position-break" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="comp-player-grip">
        <GripVertical size={14} />
      </span>
      <span className="comp-player-number">#{player.number}</span>
      {player.position && (
        <span className="comp-player-pos">{player.position}</span>
      )}
      <span className="comp-player-name">{name}</span>
      {isCrew && <Heart size={12} className="comp-player-heart" />}
      {player.previous_team && (
        <span className="comp-player-team">{player.previous_team}</span>
      )}
    </div>
  )
}
