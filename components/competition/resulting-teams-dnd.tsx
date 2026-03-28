"use client"

import { useCallback, useMemo } from "react"
import {
  DndContext,
  closestCenter,
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
} from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Heart } from "lucide-react"
import type { Player, PinnedPlayer } from "@/lib/types"
import { playerName } from "@/lib/utils"

const U15_TEAMS = ["U15AA", "U15A", "U15BB", "U15B", "U15C"]
const SLOTS_PER_TEAM: Record<string, number> = { F: 9, D: 6, G: 2 }

interface ResultingTeamsDndProps {
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  position: "F" | "D" | "G"
  crewNumbers: Set<number>
  onPinToTeam: (playerNumber: number, targetTeam: string, position: number) => void
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
    >
      <button className="comp-player-grip" {...attributes} {...listeners}>
        <GripVertical size={14} />
      </button>
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
}: {
  teamCode: string
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
}) {
  const { setNodeRef } = useDroppable({ id: `rt-${teamCode}` })
  const sortIds = players.map((p) => `rp-${p.number}`)

  return (
    <div className="comp-nt-team">
      <div className="comp-nt-header">
        <span className="comp-nt-code">{formatTeamCode(teamCode)}</span>
        <span className="comp-nt-count">
          {players.length} player{players.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="comp-nt-roster" ref={setNodeRef}>
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
  onPinToTeam,
}: ResultingTeamsDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const assignments = useMemo(() => {
    const ranked = buildRankedList(players, teamOrder, pinnedPlayers, playerOrderMap, position)
    const slotsPerTeam = SLOTS_PER_TEAM[position]
    const result: Record<string, Player[]> = {}
    let idx = 0
    for (const team of U15_TEAMS) {
      result[team] = ranked.slice(idx, idx + slotsPerTeam)
      idx += slotsPerTeam
    }
    return result
  }, [players, teamOrder, pinnedPlayers, playerOrderMap, position])

  // Lookup: player number -> which resulting team they're in
  const playerTeamMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const team of U15_TEAMS) {
      for (const p of assignments[team]) {
        map[p.number] = team
      }
    }
    return map
  }, [assignments])

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const collisions = closestCenter(args)
    const preferred = collisions.filter((c) => {
      const id = String(c.id)
      return id.startsWith("rp-") || id.startsWith("rt-")
    })
    return preferred.length > 0 ? preferred : collisions
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)

      if (!activeId.startsWith("rp-")) return

      const activeNum = Number(activeId.slice(3))
      const activeTeam = playerTeamMap[activeNum]
      if (!activeTeam) return

      let targetTeam: string

      if (overId.startsWith("rp-")) {
        const overNum = Number(overId.slice(3))
        targetTeam = playerTeamMap[overNum]
      } else if (overId.startsWith("rt-")) {
        targetTeam = overId.slice(3)
      } else {
        return
      }

      if (activeTeam === targetTeam) return

      const targetPlayers = assignments[targetTeam] || []
      onPinToTeam(activeNum, targetTeam, targetPlayers.length)
    },
    [playerTeamMap, assignments, onPinToTeam]
  )

  const visibleTeams = U15_TEAMS.filter((t) => (assignments[t]?.length || 0) > 0)

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
            players={assignments[teamCode]}
            pinnedPlayers={pinnedPlayers}
            crewNumbers={crewNumbers}
          />
        ))}
      </div>
    </DndContext>
  )
}
