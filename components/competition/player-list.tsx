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
  onUnpin?: (playerNumber: number) => void
}

export function PlayerList({
  players,
  teamCode,
  playerOrder,
  pinnedPlayers,
  crewNumbers,
  onUnpin,
}: PlayerListProps) {
  const { setNodeRef } = useDroppable({ id: `drop-${teamCode}` })

  const active: Player[] = []
  const pinnedOut: { player: Player; pinnedToTeam: string }[] = []

  for (const p of players) {
    const pinData = pinnedPlayers[String(p.number)]
    if (pinData && pinData.team !== teamCode && p.previous_team === teamCode) {
      // Player belongs to this team but was pinned elsewhere
      pinnedOut.push({ player: p, pinnedToTeam: pinData.team })
    } else if (pinData && pinData.team === teamCode) {
      // Player pinned into this team (or pinned to own team)
      active.push(p)
    } else if (p.previous_team === teamCode) {
      // Native player, no pin
      active.push(p)
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

  const sortIds = active.map((p) => `p-${p.number}`)

  return (
    <div className="comp-player-list" ref={setNodeRef}>
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {active.map((player) => {
          const pinData = pinnedPlayers[String(player.number)]
          const isPinned = !!pinData && player.previous_team !== teamCode
          return (
            <PlayerCard
              key={player.number}
              player={player}
              isPinned={isPinned}
              isCrew={crewNumbers.has(player.number)}
              originTeam={isPinned ? player.previous_team || undefined : undefined}
              onUnpin={isPinned ? onUnpin : undefined}
            />
          )
        })}
      </SortableContext>
      {pinnedOut.map(({ player, pinnedToTeam }) => (
        <PlayerCard
          key={`out-${player.number}`}
          player={player}
          isPinnedOut
          isCrew={crewNumbers.has(player.number)}
          pinnedToTeam={pinnedToTeam}
        />
      ))}
    </div>
  )
}
