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
      active.push(p)
    } else if (pinData && pinData.team !== teamCode && p.previous_team === teamCode) {
      // Player moved away from this team — skip
    } else if (p.previous_team === teamCode) {
      active.push(p)
    }
  }

  // Build overridden version of active list (effective positions)
  const hasOverrides = positionOverrides && Object.keys(positionOverrides).length > 0
  const effectiveActive = hasOverrides
    ? active.map((p) => {
        const override = positionOverrides[String(p.number)]
        if (override && override !== p.position) {
          return { ...p, position: override }
        }
        return p
      })
    : active

  // Track which players have overrides (for ghost + highlight logic)
  const overriddenNumbers = new Set<number>()
  if (hasOverrides) {
    for (const p of active) {
      const override = positionOverrides[String(p.number)]
      if (override && override !== p.position) {
        overriddenNumbers.add(p.number)
      }
    }
  }

  const POS_ORDER: Record<string, number> = { F: 0, D: 1, G: 2 }

  // Sort: custom order if set, otherwise group by position then by number
  if (playerOrder?.length) {
    effectiveActive.sort((a, b) => {
      const ai = playerOrder.indexOf(a.number)
      const bi = playerOrder.indexOf(b.number)
      if (ai === -1 && bi === -1) return a.number - b.number
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  } else {
    effectiveActive.sort((a, b) => {
      const posA = POS_ORDER[a.position || ""] ?? 99
      const posB = POS_ORDER[b.position || ""] ?? 99
      if (posA !== posB) return posA - posB
      return a.number - b.number
    })
  }

  // Filter by position
  const displayed = positionFilter && positionFilter !== "ALL"
    ? effectiveActive.filter((p) => p.position === positionFilter)
    : effectiveActive

  // Build tagged entries: each entry has a player, isGhost flag, and sortPos
  // Ghost badge shows NEW position; sortPos tracks ORIGINAL position for section placement
  const taggedEntries: { player: Player; isGhost: boolean; sortPos: string }[] = []

  if (positionFilter && positionFilter !== "ALL") {
    // Filtered view: real entries matching filter + ghosts for players whose original pos matches
    for (const p of displayed) {
      taggedEntries.push({ player: p, isGhost: false, sortPos: p.position || "" })
    }
    if (hasOverrides) {
      for (const p of active) {
        if (overriddenNumbers.has(p.number) && p.position === positionFilter) {
          taggedEntries.push({
            player: { ...p, position: positionOverrides![String(p.number)] },
            isGhost: true,
            sortPos: positionFilter,
          })
        }
      }
    }
  } else {
    // ALL view: real entries + ghosts placed in original position sections
    for (const p of effectiveActive) {
      taggedEntries.push({ player: p, isGhost: false, sortPos: p.position || "" })
    }
    if (hasOverrides) {
      for (const p of active) {
        if (overriddenNumbers.has(p.number)) {
          taggedEntries.push({
            player: { ...p, position: positionOverrides![String(p.number)] },
            isGhost: true,
            sortPos: p.position || "",
          })
        }
      }
      taggedEntries.sort((a, b) => {
        const posA = POS_ORDER[a.sortPos] ?? 99
        const posB = POS_ORDER[b.sortPos] ?? 99
        if (posA !== posB) return posA - posB
        if (a.isGhost !== b.isGhost) return a.isGhost ? 1 : -1
        return a.player.number - b.player.number
      })
    }
  }

  const sortIds = taggedEntries
    .filter((e) => !e.isGhost)
    .map((e) => `p-${e.player.number}`)

  return (
    <div className="comp-player-list" ref={setNodeRef}>
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {taggedEntries.map((entry, idx) => {
          const { player, isGhost } = entry
          const prevSortPos = idx > 0 ? taggedEntries[idx - 1].sortPos : null
          const isPositionBreak = (!positionFilter || positionFilter === "ALL")
            && prevSortPos !== null && prevSortPos !== entry.sortPos
          return (
            <PlayerCard
              key={isGhost ? `ghost-${player.number}` : player.number}
              player={player}
              isCrew={crewNumbers.has(player.number)}
              isDefense={player.position === "D"}
              showDivider={isPositionBreak}
              isOverridden={overriddenNumbers.has(player.number)}
              isGhost={isGhost}
              onLongPressPosition={isGhost ? undefined : onLongPressPosition}
            />
          )
        })}
      </SortableContext>
    </div>
  )
}
