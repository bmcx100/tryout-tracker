"use client"

import { useCallback, useMemo } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable"
import { TeamRow } from "./team-row"
import type { Player, PinnedPlayer } from "@/lib/types"

interface TeamTierListProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, position: number) => void
  onUnpin: (playerNumber: number) => void
}

export function TeamTierList({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onUnpin,
}: TeamTierListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Player number -> effective team (accounting for pins)
  const playerTeamLookup = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of allPlayers) {
      const pin = pinnedPlayers[String(p.number)]
      map[p.number] = pin ? pin.team : (p.previous_team || "")
    }
    return map
  }, [allPlayers, pinnedPlayers])

  // Player number -> position (F/D/G)
  const playerPositionLookup = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of allPlayers) {
      if (p.position) map[p.number] = p.position
    }
    return map
  }, [allPlayers])

  // Team -> ordered player numbers (effective, accounting for pins + custom order)
  const teamPlayerNumbers = useMemo(() => {
    const map: Record<string, number[]> = {}
    for (const team of teamOrder) {
      map[team] = []
    }
    for (const p of allPlayers) {
      const effectiveTeam = playerTeamLookup[p.number]
      if (effectiveTeam && map[effectiveTeam]) {
        map[effectiveTeam].push(p.number)
      }
    }
    for (const team of teamOrder) {
      const customOrder = playerOrderMap[team]
      if (customOrder?.length) {
        map[team].sort((a, b) => {
          const ai = customOrder.indexOf(a)
          const bi = customOrder.indexOf(b)
          if (ai === -1 && bi === -1) return a - b
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
      }
    }
    return map
  }, [allPlayers, teamOrder, playerTeamLookup, playerOrderMap])

  // Player drags prefer player/container targets; team drags prefer team targets
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const collisions = closestCenter(args)
    const activeId = String(args.active.id)

    if (activeId.startsWith("p-")) {
      const preferred = collisions.filter((c) => {
        const id = String(c.id)
        return id.startsWith("p-") || id.startsWith("drop-")
      })
      return preferred.length > 0 ? preferred : collisions
    }

    return collisions.filter((c) => {
      const id = String(c.id)
      return !id.startsWith("p-") && !id.startsWith("drop-")
    })
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)
      const isActivePlayer = activeId.startsWith("p-")
      const isOverPlayer = overId.startsWith("p-")
      const isOverContainer = overId.startsWith("drop-")

      // Team reorder
      if (!isActivePlayer && !isOverPlayer && !isOverContainer) {
        if (activeId === overId) return
        const oldIndex = teamOrder.indexOf(activeId)
        const newIndex = teamOrder.indexOf(overId)
        if (oldIndex === -1 || newIndex === -1) return
        onTeamReorder(arrayMove(teamOrder, oldIndex, newIndex))
        return
      }

      // Player drag
      if (isActivePlayer) {
        const activeNum = Number(activeId.slice(2))
        const activeTeam = playerTeamLookup[activeNum]
        if (!activeTeam) return

        let targetTeam: string
        let targetPosition: number

        if (isOverPlayer) {
          const overNum = Number(overId.slice(2))
          targetTeam = playerTeamLookup[overNum]
          const teamNums = teamPlayerNumbers[targetTeam] || []
          targetPosition = teamNums.indexOf(overNum)
          if (targetPosition === -1) targetPosition = teamNums.length
        } else if (isOverContainer) {
          targetTeam = overId.slice(5) // "drop-U15AA" -> "U15AA"
          targetPosition = (teamPlayerNumbers[targetTeam]?.length || 0)
        } else {
          // Dropped on a team header (collapsed team)
          targetTeam = overId
          targetPosition = 0
        }

        if (activeTeam === targetTeam) {
          // Same team reorder
          const teamNums = teamPlayerNumbers[activeTeam] || []
          const oldIndex = teamNums.indexOf(activeNum)
          const overNum = isOverPlayer ? Number(overId.slice(2)) : -1
          const newIndex = teamNums.indexOf(overNum)
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

          // Warn if moving across position groups
          const activePos = playerPositionLookup[activeNum]
          const overPos = playerPositionLookup[overNum]
          if (activePos && overPos && activePos !== overPos) {
            const posLabels: Record<string, string> = { F: "Forward", D: "Defense", G: "Goalie" }
            const confirmed = window.confirm(
              `Move a ${posLabels[activePos] || activePos} into the ${posLabels[overPos] || overPos} group?`
            )
            if (!confirmed) return
          }

          onPlayerReorder(activeTeam, arrayMove(teamNums, oldIndex, newIndex))
        } else {
          // Cross-team pin
          onPinToTeam(activeNum, targetTeam, targetPosition)
        }
      }
    },
    [teamOrder, playerTeamLookup, teamPlayerNumbers, onTeamReorder, onPlayerReorder, onPinToTeam]
  )

  const visibleTeams = teamOrder.filter(
    (t) => (playersByTeam[t]?.length || 0) > 0 || hasPinnedIn(t, pinnedPlayers)
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleTeams} strategy={verticalListSortingStrategy}>
        <div className="comp-tier-list">
          {visibleTeams.map((teamCode, idx) => {
            const teamPlayers = playersByTeam[teamCode] || []
            const pinnedInCount = countPinnedIn(teamCode, pinnedPlayers, allPlayers)
            return (
              <TeamRow
                key={teamCode}
                teamCode={teamCode}
                rank={idx + 1}
                players={teamPlayers}
                pinnedInCount={pinnedInCount}
                allPlayers={allPlayers}
                playerOrder={playerOrderMap[teamCode]}
                pinnedPlayers={pinnedPlayers}
                onUnpin={onUnpin}
              />
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function hasPinnedIn(teamCode: string, pinnedPlayers: Record<string, PinnedPlayer>): boolean {
  return Object.values(pinnedPlayers).some((p) => p.team === teamCode)
}

function countPinnedIn(
  teamCode: string,
  pinnedPlayers: Record<string, PinnedPlayer>,
  allPlayers: Player[]
): number {
  let count = 0
  for (const [numStr, pin] of Object.entries(pinnedPlayers)) {
    if (pin.team !== teamCode) continue
    const player = allPlayers.find((p) => p.number === Number(numStr))
    if (player && player.previous_team !== teamCode) count++
  }
  return count
}
