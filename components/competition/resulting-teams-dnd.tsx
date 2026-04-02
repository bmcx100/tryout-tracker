"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { AlertTriangle, ChevronDown, ChevronRight, GripVertical, Heart, Minus, Plus, X } from "lucide-react"
import type { Player, PinnedPlayer } from "@/lib/types"
import { playerName } from "@/lib/utils"
import { PositionSwitchModal } from "./position-switch-modal"

const U15_TEAMS = ["U15AA", "U15A", "U15BB", "U15B", "U15C"]

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i
  }
  return -1
}

const DEFAULT_SLOTS: Record<string, number> = { F: 9, D: 6, G: 2 }

function getTeamSlots(
  teamCode: string,
  teamSlots: Record<string, Record<string, number>>
): Record<string, number> {
  return teamSlots[teamCode] || DEFAULT_SLOTS
}

function isCustomSlots(
  teamCode: string,
  teamSlots: Record<string, Record<string, number>>
): boolean {
  const custom = teamSlots[teamCode]
  if (!custom) return false
  return custom.F !== DEFAULT_SLOTS.F || custom.D !== DEFAULT_SLOTS.D || custom.G !== DEFAULT_SLOTS.G
}

function applyPositionOverrides(
  players: Player[],
  overrides: Record<string, string>
): Player[] {
  if (!overrides || Object.keys(overrides).length === 0) return players
  return players.map((p) => {
    const override = overrides[String(p.number)]
    if (override && override !== p.position) {
      return { ...p, position: override }
    }
    return p
  })
}

interface ResultingTeamsDndProps {
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  teamSlots: Record<string, Record<string, number>>
  position: "F" | "D" | "G" | "ALL"
  crewNumbers: Set<number>
  positionOverrides: Record<string, string>
  onReorder: (team: string, playerNumbers: number[]) => void
  onUpdateTeamSlots: (teamCode: string, slots: Record<string, number> | null) => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
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
  showDivider,
  isOverridden,
  isGhost,
  onLongPressPosition,
}: {
  player: Player
  rank: number
  isCrew: boolean
  isPinned: boolean
  showDivider?: boolean
  isOverridden: boolean
  isGhost?: boolean
  onLongPressPosition?: (player: Player) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: isGhost ? `ghost-${player.number}` : `rp-${player.number}`, disabled: isGhost })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const posLongPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didPosLongPress = useRef(false)

  const canSwitch = player.position === "F" || player.position === "D"

  const handlePosPointerDown = (e: React.PointerEvent) => {
    if (!canSwitch || !onLongPressPosition) return
    e.stopPropagation()
    didPosLongPress.current = false
    posLongPress.current = setTimeout(() => {
      didPosLongPress.current = true
      onLongPressPosition(player)
    }, 500)
  }

  const handlePosPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (posLongPress.current) {
      clearTimeout(posLongPress.current)
      posLongPress.current = null
    }
  }

  const handlePosPointerLeave = () => {
    if (posLongPress.current) {
      clearTimeout(posLongPress.current)
      posLongPress.current = null
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`comp-nt-player${player.position === "D" ? " comp-nt-defense" : ""}${isPinned ? " comp-nt-pinned" : ""}${isCrew ? " comp-nt-crew" : ""}${isDragging ? " comp-player-dragging" : ""}${showDivider ? " comp-position-break" : ""}${isGhost ? " comp-player-ghost" : ""}`}
      {...(isGhost ? {} : attributes)}
      {...(isGhost ? {} : listeners)}
    >
      <span className="comp-player-grip">
        <GripVertical size={14} />
      </span>
      <span className="comp-nt-rank">{isGhost ? "" : rank}</span>
      <span className="comp-player-number">#{player.number}</span>
      <span
        className={`comp-player-pos${isOverridden ? " comp-player-pos-override" : ""}`}
        onPointerDown={canSwitch ? handlePosPointerDown : undefined}
        onPointerUp={canSwitch ? handlePosPointerUp : undefined}
        onPointerLeave={canSwitch ? handlePosPointerLeave : undefined}
      >
        {player.position}
      </span>
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

function SlotEditorModal({
  teamCode,
  slots,
  onSave,
  onClose,
}: {
  teamCode: string
  slots: Record<string, number>
  onSave: (slots: Record<string, number> | null) => void
  onClose: () => void
}) {
  const [f, setF] = useState(slots.F ?? DEFAULT_SLOTS.F)
  const [d, setD] = useState(slots.D ?? DEFAULT_SLOTS.D)
  const [g, setG] = useState(slots.G ?? DEFAULT_SLOTS.G)

  const isDefault = f === DEFAULT_SLOTS.F && d === DEFAULT_SLOTS.D && g === DEFAULT_SLOTS.G

  const handleSave = () => {
    if (isDefault) {
      onSave(null)
    } else {
      onSave({ F: f, D: d, G: g })
    }
    onClose()
  }

  const handleReset = () => {
    setF(DEFAULT_SLOTS.F)
    setD(DEFAULT_SLOTS.D)
    setG(DEFAULT_SLOTS.G)
  }

  return (
    <div className="slot-modal-overlay" onClick={onClose}>
      <div className="slot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="slot-modal-header">
          <span className="slot-modal-title">{formatTeamCode(teamCode)} Roster Size</span>
          <button className="slot-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="slot-modal-body">
          <div className="slot-row">
            <span className="slot-label">Forwards</span>
            <div className="slot-controls">
              <button className="slot-btn" onClick={() => setF(Math.max(0, f - 1))} disabled={f <= 0}>
                <Minus size={14} />
              </button>
              <span className="slot-value">{f}</span>
              <button className="slot-btn" onClick={() => setF(f + 1)}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="slot-row">
            <span className="slot-label">Defense</span>
            <div className="slot-controls">
              <button className="slot-btn" onClick={() => setD(Math.max(0, d - 1))} disabled={d <= 0}>
                <Minus size={14} />
              </button>
              <span className="slot-value">{d}</span>
              <button className="slot-btn" onClick={() => setD(d + 1)}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="slot-row">
            <span className="slot-label">Goalies</span>
            <div className="slot-controls">
              <button className="slot-btn" onClick={() => setG(Math.max(0, g - 1))} disabled={g <= 0}>
                <Minus size={14} />
              </button>
              <span className="slot-value">{g}</span>
              <button className="slot-btn" onClick={() => setG(g + 1)}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className={`slot-total${(f + d + g < 16 || f + d + g > 17) ? " slot-total-warning" : ""}`}>
            {(f + d + g < 16 || f + d + g > 17) && <AlertTriangle size={12} />}
            Total: {f + d + g} players
          </div>
        </div>
        <div className="slot-modal-footer">
          {!isDefault && (
            <button className="slot-reset-btn" onClick={handleReset}>
              Reset to Default
            </button>
          )}
          <button className="slot-save-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function DroppableTeam({
  teamCode,
  players,
  pinnedPlayers,
  crewNumbers,
  defaultCollapsed,
  isCustom,
  position,
  totalPlayers,
  positionOverrides,
  onOpenSlotEditor,
  onLongPressPosition,
}: {
  teamCode: string
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  defaultCollapsed: boolean
  isCustom: boolean
  position: "F" | "D" | "G" | "ALL"
  totalPlayers: number
  positionOverrides: Record<string, string>
  onOpenSlotEditor: (teamCode: string) => void
  onLongPressPosition: (player: Player) => void
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const { setNodeRef } = useDroppable({ id: `rt-${teamCode}` })
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  // Counts use effective (overridden) positions
  const fCount = players.filter((p) => p.position === "F").length
  const dCount = players.filter((p) => p.position === "D").length
  const gCount = players.filter((p) => p.position === "G").length

  // Build ghost entries for overridden players
  // Ghost keeps effective (new) position for badge display, tracks original for section placement
  const overriddenNumbers = new Set<number>()
  const ghostData: { player: Player; originalPos: string }[] = []
  for (const p of players) {
    if (positionOverrides[String(p.number)]) {
      overriddenNumbers.add(p.number)
      const originalPos = p.position === "F" ? "D" : "F"
      ghostData.push({ player: p, originalPos })
    }
  }

  // Build display list: real players + ghosts in their original position sections
  // sortPos tracks section placement (original pos for ghosts) for divider logic
  const allEntries: { player: Player; isGhost: boolean; sortPos: string }[] = []
  if (position === "ALL") {
    const POS_ORDER: Record<string, number> = { F: 0, D: 1, G: 2 }
    allEntries.push(
      ...players.map((p) => ({ player: p, isGhost: false, sortPos: p.position || "" })),
      ...ghostData.map((g) => ({ player: g.player, isGhost: true, sortPos: g.originalPos })),
    )
    allEntries.sort((a, b) => {
      const posA = POS_ORDER[a.sortPos] ?? 99
      const posB = POS_ORDER[b.sortPos] ?? 99
      if (posA !== posB) return posA - posB
      if (a.isGhost !== b.isGhost) return a.isGhost ? 1 : -1
      return 0
    })
  } else {
    for (const p of players) {
      allEntries.push({ player: p, isGhost: false, sortPos: p.position || "" })
    }
    for (const g of ghostData) {
      if (g.originalPos === position) {
        allEntries.push({ player: g.player, isGhost: true, sortPos: g.originalPos })
      }
    }
  }

  const sortIds = allEntries
    .filter((e) => !e.isGhost)
    .map((e) => `rp-${e.player.number}`)

  const handlePointerDown = () => {
    didLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true
      onOpenSlotEditor(teamCode)
    }, 500)
  }

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (!didLongPress.current) {
      setCollapsed((c) => !c)
    }
  }

  const handlePointerLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Build count display based on active position tab
  const countLabel = position === "ALL"
    ? `${fCount}F · ${dCount}D · ${gCount}G`
    : position === "F"
      ? `${fCount} Forwards`
      : position === "D"
        ? `${dCount} Defense`
        : `${gCount} Goalies`

  const hasWarning = totalPlayers < 16 || totalPlayers > 17

  return (
    <div className="comp-nt-team" ref={setNodeRef}>
      <div
        className="comp-nt-header comp-nt-toggle"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        <span className="comp-nt-code">{formatTeamCode(teamCode)}</span>
        <span className={`comp-nt-count${isCustom ? " comp-nt-count-custom" : ""}`}>
          {countLabel}
        </span>
        {hasWarning && (
          <span className="comp-nt-warning">
            <AlertTriangle size={12} />
            {totalPlayers} total
          </span>
        )}
      </div>
      {!collapsed && (
        <div className="comp-nt-roster">
          <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
            {allEntries.map((entry, idx) => {
              const { player, isGhost: entryIsGhost } = entry
              const pin = pinnedPlayers[String(player.number)]
              const isPinned = !!pin && player.previous_team !== pin.team
              const prevSortPos = idx > 0 ? allEntries[idx - 1].sortPos : null
              const isPositionBreak = position === "ALL"
                && prevSortPos !== null && prevSortPos !== entry.sortPos
              // Non-ghost rank: count only real entries
              const realRank = entryIsGhost ? 0 : allEntries
                .slice(0, idx + 1)
                .filter((e) => !e.isGhost).length
              return (
                <DraggablePlayerRow
                  key={entryIsGhost ? `ghost-${player.number}` : player.number}
                  player={player}
                  rank={realRank}
                  isCrew={crewNumbers.has(player.number)}
                  isPinned={isPinned}
                  showDivider={isPositionBreak}
                  isOverridden={overriddenNumbers.has(player.number)}
                  isGhost={entryIsGhost}
                  onLongPressPosition={entryIsGhost ? undefined : onLongPressPosition}
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
  teamSlots,
  position,
  crewNumbers,
  positionOverrides,
  onReorder,
  onUpdateTeamSlots,
  onPositionOverride,
}: ResultingTeamsDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const effectivePlayers = useMemo(
    () => applyPositionOverrides(players, positionOverrides),
    [players, positionOverrides]
  )

  const [slotEditorTeam, setSlotEditorTeam] = useState<string | null>(null)
  const [switchTarget, setSwitchTarget] = useState<Player | null>(null)

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
      const ranked = buildRankedList(effectivePlayers, teamOrder, pinnedPlayers, playerOrderMap, pos)
      let idx = 0
      for (const team of U15_TEAMS) {
        const slots = getTeamSlots(team, teamSlots)
        const slotsForPos = slots[pos] ?? DEFAULT_SLOTS[pos]
        computed[team].push(...ranked.slice(idx, idx + slotsForPos))
        idx += slotsForPos
      }
    }

    // If rt: overrides exist, they are the source of truth for team membership
    const hasOverrides = U15_TEAMS.some((t) => playerOrderMap[`rt:${t}`]?.length > 0)
    if (!hasOverrides) return computed

    const playerMap = new Map(effectivePlayers.map((p) => [p.number, p]))
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
  }, [effectivePlayers, teamOrder, pinnedPlayers, playerOrderMap, teamSlots, position])

  const handleConfirmSwitch = useCallback(() => {
    if (!switchTarget) return
    const currentPos = switchTarget.position
    const originalPos = players.find((p) => p.number === switchTarget.number)?.position
    const isReverting = currentPos !== originalPos

    if (isReverting) {
      onPositionOverride(switchTarget.number, null)
    } else {
      const newPos = currentPos === "F" ? "D" : "F"
      onPositionOverride(switchTarget.number, newPos)
    }
    setSwitchTarget(null)
  }, [switchTarget, players, onPositionOverride])

  // Compute full team totals (all positions) for the warning indicator
  const fullTeamTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const team of U15_TEAMS) {
      const slots = getTeamSlots(team, teamSlots)
      totals[team] = (slots.F ?? DEFAULT_SLOTS.F) + (slots.D ?? DEFAULT_SLOTS.D) + (slots.G ?? DEFAULT_SLOTS.G)
    }
    return totals
  }, [teamSlots])

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
    <>
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
              defaultCollapsed={false}
              isCustom={isCustomSlots(teamCode, teamSlots)}
              position={position}
              totalPlayers={fullTeamTotals[teamCode] ?? 17}
              positionOverrides={positionOverrides}
              onOpenSlotEditor={setSlotEditorTeam}
              onLongPressPosition={setSwitchTarget}
            />
          ))}
        </div>
      </DndContext>
      {slotEditorTeam && (
        <SlotEditorModal
          teamCode={slotEditorTeam}
          slots={getTeamSlots(slotEditorTeam, teamSlots)}
          onSave={(slots) => onUpdateTeamSlots(slotEditorTeam, slots)}
          onClose={() => setSlotEditorTeam(null)}
        />
      )}
      {switchTarget && (
        <PositionSwitchModal
          player={switchTarget}
          originalPosition={players.find((p) => p.number === switchTarget.number)?.position ?? switchTarget.position ?? "F"}
          onConfirm={handleConfirmSwitch}
          onClose={() => setSwitchTarget(null)}
        />
      )}
    </>
  )
}
