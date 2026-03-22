"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pin, ArrowRight, Heart } from "lucide-react"
import type { Player } from "@/lib/types"
import { playerName } from "@/lib/utils"

interface PlayerCardProps {
  player: Player
  isPinned?: boolean
  isPinnedOut?: boolean
  isCrew?: boolean
  pinnedToTeam?: string
  originTeam?: string
  onUnpin?: (playerNumber: number) => void
}

export function PlayerCard({
  player,
  isPinned,
  isPinnedOut,
  isCrew,
  pinnedToTeam,
  originTeam,
  onUnpin,
}: PlayerCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `p-${player.number}`, disabled: !!isPinnedOut })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const name = playerName(player.first_name, player.last_name, player.number)

  if (isPinnedOut) {
    return (
      <div className="comp-player-card comp-player-pinned-out">
        <div className="comp-player-grip" />
        <span className="comp-player-number">#{player.number}</span>
        {player.position && (
          <span className="comp-player-pos">{player.position}</span>
        )}
        <span className="comp-player-name">{name}</span>
        {isCrew && <Heart size={12} className="comp-player-heart" />}
        <span className="comp-player-moved">
          <ArrowRight size={12} />
          {pinnedToTeam}
        </span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`comp-player-card${isDragging ? " comp-player-dragging" : ""}${isPinned ? " comp-player-pinned" : ""}`}
    >
      <button className="comp-player-grip" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
      <span className="comp-player-number">#{player.number}</span>
      {player.position && (
        <span className="comp-player-pos">{player.position}</span>
      )}
      <span className="comp-player-name">{name}</span>
      {isCrew && <Heart size={12} className="comp-player-heart" />}
      {player.previous_team && (
        <span className="comp-player-team">{player.previous_team}</span>
      )}
      {isPinned && originTeam && (
        <span className="comp-player-origin">
          <Pin size={10} />
          {originTeam}
        </span>
      )}
      {isPinned && onUnpin && (
        <button
          className="comp-player-pin-btn comp-player-unpin"
          onClick={() => onUnpin(player.number)}
          title="Unpin"
        >
          <Pin size={12} />
        </button>
      )}
    </div>
  )
}
