"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  closestCenter,
  pointerWithin,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core"
import { useDroppable } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, ChevronRight, GripVertical, Heart } from "lucide-react"
import type { Player, PinnedPlayer } from "@/lib/types"
import { playerName } from "@/lib/utils"

const U15_TEAMS = ["U15AA", "U15A", "U15BB", "U15B", "U15C"]

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}

const SLOTS_PER_TEAM: Record<string, number> = { F: 9, D: 6, G: 2 }

interface ResultingTeamsDndProps {
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  position: "F" | "D" | "G" | "ALL"
  crewNumbers: Set<number>
  onReorder: (team: string, playerNumbers: number[]) => void
}

function formatTeamCode(code: string): string {
  const match = code.match(/^(U\d+)(AA|A|BB|B|C)$/)
  if (!match) return code
  return `${match[1]} ${match[2]}`
}

function buildRankedList(
  players: Player[],
  teamOrder: string[],
  pinnedPlayers: Record<string, PinnedPlayer>,
  playerOrderMap: Record<string, number[]>,
  pos: "F" | "D" | "G"
): Player[] {
  const posPlayers = players.filter((p) => p.position === pos)

  const effectiveTeam: Record<number, string> = {}
  for (const p of posPlayers) {
    const pin = pinnedPlayers[String(p.number)]
    effectiveTeam[p.number] = pin ? pin.team : (p.previous_team || "")
  }

  const byTeam: Record<string, Player[]> = {}
  for (const p of posPlayers) {
    const team = effectiveTeam[p.number]
    if (!byTeam[team]) byTeam[team] = []
    byTeam[team].push(p)
  }

  for (const team of Object.keys(byTeam)) {
    const customOrder = playerOrderMap[team]
    if (customOrder?.length) {
      byTeam[team].sort((a, b) => {
        const ai = customOrder.indexOf(a.number)
        const bi = customOrder.indexOf(b.number)
        if (ai === -1 && bi === -1) return a.number - b.number
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    } else {
      byTeam[team].sort((a, b) => a.number - b.number)
    }
  }

  const ranked: Player[] = []
  for (const team of teamOrder) {
    if (byTeam[team]) ranked.push(...byTeam[team])
  }
  for (const team of Object.keys(byTeam)) {
    if (!teamOrder.includes(team)) ranked.push(...byTeam[team])
  }

  return ranked
}

function DraggablePlayerRow({
  player,
  rank,
  isCrew,
  isPinned,
}: {
  player: Player
  rank: number
  isCrew: boolean
  isPinned: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `rp-${player.number}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`comp-nt-player${isPinned ? " comp-nt-pinned" : ""}${isCrew ? " comp-nt-crew" : ""}${isDragging ? " comp-player-dragging" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="comp-player-grip">
        <GripVertical size={14} />
      </span>
      <span className="comp-nt-rank">{rank}</span>
      <span className="comp-player-number">#{player.number}</span>
      <span className="comp-player-pos">{player.position}</span>
      <span className="comp-player-name">
        {playerName(player.first_name, player.last_name, player.number)}
      </span>
      {isCrew && <Heart size={12} className="comp-player-heart" />}
      {player.previous_team && (
        <span className="comp-nt-prev-team">{player.previous_team}</span>
      )}
    </div>
  )
}

function DroppableTeam({
  teamCode,
  players,
  pinnedPlayers,
  crewNumbers,
  defaultCollapsed,
}: {
  teamCode: string
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  defaultCollapsed: boolean
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const { setNodeRef } = useDroppable({ id: `rt-${teamCode}` })
  const sortIds = players.map((p) => `rp-${p.number}`)

  return (
    <div className="comp-nt-team" ref={setNodeRef}>
      <button className="comp-nt-header comp-nt-toggle" onClick={() => setCollapsed((c) => !c)}>
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <span className="comp-nt-code">{formatTeamCode(teamCode)}</span>
        <span className="comp-nt-count">
          {players.length} player{players.length !== 1 ? "s" : ""}
        </span>
      </button>
      {!collapsed && (
        <div className="comp-nt-roster">
          <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
            {players.map((player, idx) => {
              const pin = pinnedPlayers[String(player.number)]
              const isPinned = !!pin && player.previous_team !== pin.team
              return (
                <DraggablePlayerRow
                  key={player.number}
                  player={player}
                  rank={idx + 1}
                  isCrew={crewNumbers.has(player.number)}
                  isPinned={isPinned}
                />
              )
            })}
          </SortableContext>
        </div>
      )}
    </div>
  )
}

export function ResultingTeamsDnd({
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  position,
  crewNumbers,
  onReorder,
}: ResultingTeamsDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const assignments = useMemo(() => {
    const positions: ("F" | "D" | "G")[] = position === "ALL"
      ? ["F", "D", "G"]
      : [position]

    // Compute initial assignments from ranking
    const computed: Record<string, Player[]> = {}
    for (const team of U15_TEAMS) {
      computed[team] = []
    }

    for (const pos of positions) {
      const ranked = buildRankedList(players, teamOrder, pinnedPlayers, playerOrderMap, pos)
      const slotsPerTeam = SLOTS_PER_TEAM[pos]
      let idx = 0
      for (const team of U15_TEAMS) {
        computed[team].push(...ranked.slice(idx, idx + slotsPerTeam))
        idx += slotsPerTeam
      }
    }

    // If rt: overrides exist, they are the source of truth for team membership
    const hasOverrides = U15_TEAMS.some((t) => playerOrderMap[`rt:${t}`]?.length > 0)
    if (!hasOverrides) return computed

    const playerMap = new Map(players.map((p) => [p.number, p]))
    const result: Record<string, Player[]> = {}
    const assigned = new Set<number>()

    // First pass: teams with rt: overrides
    for (const team of U15_TEAMS) {
      const order = playerOrderMap[`rt:${team}`]
      if (order?.length) {
        result[team] = order
          .map((num) => playerMap.get(num))
          .filter((p): p is Player => !!p)
        for (const p of result[team]) assigned.add(p.number)
      }
    }

    // Second pass: teams without overrides use computed, minus already-assigned players
    for (const team of U15_TEAMS) {
      if (!result[team]) {
        result[team] = computed[team].filter((p) => !assigned.has(p.number))
        for (const p of result[team]) assigned.add(p.number)
      }
    }

    return result
  }, [players, teamOrder, pinnedPlayers, playerOrderMap, position])

  // Local roster state for immediate visual feedback during drags
  const [localRosters, setLocalRosters] = useState<Record<string, Player[]> | null>(null)

  useEffect(() => {
    setLocalRosters(null)
  }, [assignments])

  const displayRosters = localRosters || assignments

  // Lookup: player number -> which resulting team they're in
  const playerTeamMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const team of U15_TEAMS) {
      for (const p of (displayRosters[team] || [])) {
        map[p.number] = team
      }
    }
    return map
  }, [displayRosters])

  const collisionDetection: CollisionDetection = useCallback((args) => {
    // Use pointerWithin for precise targeting (what's actually under the cursor)
    const pointerHits = pointerWithin(args).filter((c) => {
      const id = String(c.id)
      return id.startsWith("rp-") || id.startsWith("rt-")
    })

    // Prefer player targets over team containers (more specific)
    const playerHits = pointerHits.filter((c) => String(c.id).startsWith("rp-"))
    if (playerHits.length > 0) return playerHits

    const teamHits = pointerHits.filter((c) => String(c.id).startsWith("rt-"))
    if (teamHits.length > 0) return teamHits

    // Fall back to closestCenter when pointer is between elements
    const fallback = closestCenter(args).filter((c) => {
      const id = String(c.id)
      return id.startsWith("rp-") || id.startsWith("rt-")
    })
    return fallback
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)
      if (!activeId.startsWith("rp-")) return

      const activeNum = Number(activeId.slice(3))
      const currentRosters = localRosters || assignments
      const sourceTeam = playerTeamMap[activeNum]
      if (!sourceTeam) return

      // Determine target team and index
      let targetTeam: string | undefined
      let overIndex: number | undefined

      if (overId.startsWith("rp-")) {
        const overNum = Number(overId.slice(3))
        targetTeam = playerTeamMap[overNum]
        if (targetTeam) {
          overIndex = (currentRosters[targetTeam] || []).findIndex((p) => p.number === overNum)
        }
      } else if (overId.startsWith("rt-")) {
        targetTeam = overId.slice(3)
        overIndex = (currentRosters[targetTeam] || []).length
      }

      if (!targetTeam || overIndex === undefined || overIndex < 0) return

      // Build new rosters
      const newRosters: Record<string, Player[]> = {}
      for (const team of U15_TEAMS) {
        newRosters[team] = [...(currentRosters[team] || [])]
      }

      if (sourceTeam === targetTeam) {
        // Same-team reorder
        const roster = newRosters[sourceTeam]
        const oldIndex = roster.findIndex((p) => p.number === activeNum)
        if (oldIndex === -1 || oldIndex === overIndex) return
        newRosters[sourceTeam] = arrayMove(roster, oldIndex, overIndex)
        onReorder(`rt:${sourceTeam}`, newRosters[sourceTeam].map((p) => p.number))
      } else {
        // Cross-team move with cascading to maintain roster counts
        const sourceRoster = newRosters[sourceTeam]
        const oldIndex = sourceRoster.findIndex((p) => p.number === activeNum)
        if (oldIndex === -1) return
        const [moved] = sourceRoster.splice(oldIndex, 1)
        newRosters[targetTeam].splice(overIndex, 0, moved)

        // Cascade: rebalance teams between source and target (same position only)
        const sourceIdx = U15_TEAMS.indexOf(sourceTeam)
        const targetIdx = U15_TEAMS.indexOf(targetTeam)
        const movedPos = moved.position

        if (sourceIdx < targetIdx) {
          // Player moved DOWN — source team is short, pull top same-position player up from below
          for (let i = sourceIdx; i < targetIdx; i++) {
            const currentTeam = U15_TEAMS[i]
            const nextTeam = U15_TEAMS[i + 1]
            const nextRoster = newRosters[nextTeam]
            const promoteIdx = nextRoster.findIndex((p) => p.position === movedPos)
            if (promoteIdx !== -1) {
              const [promoted] = nextRoster.splice(promoteIdx, 1)
              newRosters[currentTeam].push(promoted)
            }
          }
        } else {
          // Player moved UP — source team has extra, push bottom same-position player down from above
          for (let i = sourceIdx; i > targetIdx; i--) {
            const currentTeam = U15_TEAMS[i]
            const prevTeam = U15_TEAMS[i - 1]
            const prevRoster = newRosters[prevTeam]
            const lastIdx = findLastIndex(prevRoster, (p) => p.position === movedPos)
            if (lastIdx !== -1) {
              const [demoted] = prevRoster.splice(lastIdx, 1)
              newRosters[currentTeam].unshift(demoted)
            }
          }
        }

        for (const team of U15_TEAMS) {
          onReorder(`rt:${team}`, (newRosters[team] || []).map((p) => p.number))
        }
      }

      setLocalRosters(newRosters)
    },
    [localRosters, assignments, playerTeamMap, onReorder]
  )

  const visibleTeams = U15_TEAMS.filter((t) => (displayRosters[t]?.length || 0) > 0)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragEnd={handleDragEnd}
    >
      <div className="comp-new-teams">
        {visibleTeams.map((teamCode) => (
          <DroppableTeam
            key={teamCode}
            teamCode={teamCode}
            players={displayRosters[teamCode]}
            pinnedPlayers={pinnedPlayers}
            crewNumbers={crewNumbers}
            defaultCollapsed
          />
        ))}
      </div>
    </DndContext>
  )
}
