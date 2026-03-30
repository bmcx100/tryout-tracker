"use client"

import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { PlayerCard } from "./player-card"
import type { Player, PinnedPlayer } from "@/lib/types"

interface PlayerListProps {
  players: Player[]
  teamCode: string
  playerOrder?: number[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  positionFilter?: "F" | "D" | "G" | "ALL"
  positionOverrides?: Record<string, string>
  onLongPressPosition?: (player: Player) => void
}

export function PlayerList({
  players,
  teamCode,
  playerOrder,
  pinnedPlayers,
  crewNumbers,
  positionFilter,
  positionOverrides,
  onLongPressPosition,
}: PlayerListProps) {
  const { setNodeRef } = useDroppable({ id: `drop-${teamCode}` })

  const active: Player[] = []

  for (const p of players) {
    const pinData = pinnedPlayers[String(p.number)]
    if (pinData && pinData.team === teamCode) {
      // Player moved into this team
      active.push(p)
    } else if (pinData && pinData.team !== teamCode && p.previous_team === teamCode) {
      // Player moved away from this team — skip, they live elsewhere now
    } else if (p.previous_team === teamCode) {
      // Native player, no move
      active.push(p)
    }
  }

  // Apply position overrides
  if (positionOverrides && Object.keys(positionOverrides).length > 0) {
    for (let i = 0; i < active.length; i++) {
      const override = positionOverrides[String(active[i].number)]
      if (override && override !== active[i].position) {
        active[i] = { ...active[i], position: override }
      }
    }
  }

  const POS_ORDER: Record<string, number> = { F: 0, D: 1, G: 2 }

  // Sort: custom order if set, otherwise group by position then by number
  if (playerOrder?.length) {
    active.sort((a, b) => {
      const ai = playerOrder.indexOf(a.number)
      const bi = playerOrder.indexOf(b.number)
      if (ai === -1 && bi === -1) return a.number - b.number
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  } else {
    active.sort((a, b) => {
      const posA = POS_ORDER[a.position || ""] ?? 99
      const posB = POS_ORDER[b.position || ""] ?? 99
      if (posA !== posB) return posA - posB
      return a.number - b.number
    })
  }

  const displayed = positionFilter && positionFilter !== "ALL"
    ? active.filter((p) => p.position === positionFilter)
    : active

  const sortIds = displayed.map((p) => `p-${p.number}`)

  return (
    <div className="comp-player-list" ref={setNodeRef}>
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {displayed.map((player, idx) => {
          const prevPos = idx > 0 ? displayed[idx - 1].position : null
          const isPositionBreak = (!positionFilter || positionFilter === "ALL")
            && prevPos !== null && prevPos !== player.position
          return (
            <PlayerCard
              key={player.number}
              player={player}
              isCrew={crewNumbers.has(player.number)}
              isDefense={player.position === "D"}
              showDivider={isPositionBreak}
              isOverridden={!!(positionOverrides && positionOverrides[String(player.number)])}
              onLongPressPosition={onLongPressPosition}
            />
          )
        })}
      </SortableContext>
    </div>
  )
}
