"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable"
import { TeamRow } from "./team-row"
import { PlayerCard } from "./player-card"
import { PositionSwitchModal } from "./position-switch-modal"
import type { Player, PinnedPlayer } from "@/lib/types"
import { extractLevelFromTeam } from "@/lib/utils"

interface TeamTierListProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  missingPlayerNumbers?: Set<number>
  positionFilter?: "F" | "D" | "G" | "ALL"
  positionOverrides?: Record<string, string>
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, position: number) => void
  onPositionOverride?: (playerNumber: number, newPosition: string | null) => void
  mode?: "teams" | "players"
  demoExpandedTeams?: Set<string>
  onUserInteraction?: () => void
  replayDemoKey?: number
}

export function TeamTierList({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  crewNumbers,
  missingPlayerNumbers,
  positionFilter,
  positionOverrides,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onPositionOverride,
  mode,
  demoExpandedTeams,
  onUserInteraction,
  replayDemoKey,
}: TeamTierListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Local state for immediate visual feedback on player drags
  const [localPinned, setLocalPinned] = useState<Record<string, PinnedPlayer> | null>(null)
  const [localPlayerOrder, setLocalPlayerOrder] = useState<Record<string, number[]> | null>(null)

  useEffect(() => { setLocalPinned(null) }, [pinnedPlayers])
  useEffect(() => { setLocalPlayerOrder(null) }, [playerOrderMap])

  const effectivePinned = localPinned || pinnedPlayers
  const effectivePlayerOrder = localPlayerOrder || playerOrderMap

  // Player number -> effective team (accounting for moves)
  const playerTeamLookup = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of allPlayers) {
      const pin = effectivePinned[String(p.number)]
      map[p.number] = pin ? pin.team : (p.previous_team || "")
    }
    return map
  }, [allPlayers, effectivePinned])

  // Player number -> position (F/D/G), with overrides applied
  const playerPositionLookup = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of allPlayers) {
      if (p.position) map[p.number] = p.position
    }
    if (positionOverrides) {
      for (const [numStr, pos] of Object.entries(positionOverrides)) {
        map[Number(numStr)] = pos
      }
    }
    return map
  }, [allPlayers, positionOverrides])

  const [switchTarget, setSwitchTarget] = useState<Player | null>(null)
  const [activeDragPlayer, setActiveDragPlayer] = useState<Player | null>(null)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const activeId = String(event.active.id)
    if (activeId.startsWith("p-")) {
      const num = Number(activeId.slice(2))
      const player = allPlayers.find((p) => p.number === num)
      if (player) setActiveDragPlayer(player)
    }
  }, [allPlayers])

  const handleConfirmSwitch = useCallback(() => {
    if (!switchTarget || !onPositionOverride) return
    const currentPos = switchTarget.position
    const originalPos = allPlayers.find((p) => p.number === switchTarget.number)?.position
    const isReverting = currentPos !== originalPos

    if (isReverting) {
      onPositionOverride(switchTarget.number, null)
    } else {
      const newPos = currentPos === "F" ? "D" : "F"
      onPositionOverride(switchTarget.number, newPos)
    }
    setSwitchTarget(null)
  }, [switchTarget, allPlayers, onPositionOverride])

  // Team -> ordered player numbers (effective, accounting for moves + custom order)
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
      const customOrder = effectivePlayerOrder[team]
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
  }, [allPlayers, teamOrder, playerTeamLookup, effectivePlayerOrder])

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
      setActiveDragPlayer(null)
      const { active, over } = event
      if (!over) return

      const activeId = String(active.id)
      const overId = String(over.id)
      const isActivePlayer = activeId.startsWith("p-")
      const isOverPlayer = overId.startsWith("p-")
      const isOverContainer = overId.startsWith("drop-")

      // Team reorder
      if (!isActivePlayer && !isOverPlayer && !isOverContainer) {
        if (mode === "players") return

        if (activeId === overId) return
        const oldIndex = teamOrder.indexOf(activeId)
        const newIndex = teamOrder.indexOf(overId)
        if (oldIndex === -1 || newIndex === -1) return
        setMovedTeams((prev) => new Set(prev).add(activeId))
        onTeamReorder(arrayMove(teamOrder, oldIndex, newIndex))
        return
      }

      // Player drag
      if (isActivePlayer && mode !== "teams") {
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

          const newOrder = arrayMove(teamNums, oldIndex, newIndex)
          setLocalPlayerOrder((prev) => ({
            ...(prev || playerOrderMap),
            [activeTeam]: newOrder,
          }))
          onPlayerReorder(activeTeam, newOrder)
        } else {
          // Cross-team move — update local state immediately for visual feedback
          setLocalPinned((prev) => ({
            ...(prev || pinnedPlayers),
            [String(activeNum)]: { team: targetTeam, position: targetPosition },
          }))

          // Build new player order for target team with player inserted at correct position
          const currentTargetNums = [...(teamPlayerNumbers[targetTeam] || [])]
          currentTargetNums.splice(targetPosition, 0, activeNum)
          setLocalPlayerOrder((prev) => ({
            ...(prev || playerOrderMap),
            [activeTeam]: (teamPlayerNumbers[activeTeam] || []).filter((n) => n !== activeNum),
            [targetTeam]: currentTargetNums,
          }))

          onPinToTeam(activeNum, targetTeam, targetPosition)
          onPlayerReorder(targetTeam, currentTargetNums)
          onPlayerReorder(activeTeam, (teamPlayerNumbers[activeTeam] || []).filter((n) => n !== activeNum))
        }
      }
    },
    [teamOrder, playerTeamLookup, playerPositionLookup, teamPlayerNumbers, playerOrderMap, pinnedPlayers, onTeamReorder, onPlayerReorder, onPinToTeam, mode]
  )

  // Count players per team using effective assignments
  const teamPlayerCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const team of teamOrder) {
      counts[team] = (teamPlayerNumbers[team] || []).length
    }
    return counts
  }, [teamOrder, teamPlayerNumbers])

  // Filtered counts for display when position filter is active
  const filteredPlayerCounts = useMemo(() => {
    if (!positionFilter || positionFilter === "ALL") return teamPlayerCounts
    const counts: Record<string, number> = {}
    for (const team of teamOrder) {
      const nums = teamPlayerNumbers[team] || []
      counts[team] = nums.filter((n) => playerPositionLookup[n] === positionFilter).length
    }
    return counts
  }, [teamOrder, teamPlayerNumbers, playerPositionLookup, positionFilter, teamPlayerCounts])

  const visibleTeams = useMemo(
    () => teamOrder.filter((t) => teamPlayerCounts[t] > 0),
    [teamOrder, teamPlayerCounts]
  )

  // Demo drag hint state for teams mode
  const listRef = useRef<HTMLDivElement>(null)
  const [animating, setAnimating] = useState(false)
  const [movedTeams, setMovedTeams] = useState<Set<string>>(new Set())
  const [demoOffsets, setDemoOffsets] = useState<{ high: number; low: number; shift: number } | null>(null)
  const [demoAnimKey, setDemoAnimKey] = useState(0)
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Age group analysis
  const ages = useMemo(() => visibleTeams.map((t) => t.match(/^(U\d+)/)?.[1] || ""), [visibleTeams])

  // Upper (older) age group for distinguishing lower-age teams
  const upperAge = useMemo(() => {
    const unique = [...new Set(ages)].filter(Boolean)
    if (unique.length < 2) return null
    return unique.sort((a, b) => parseInt(b.replace("U", "")) - parseInt(a.replace("U", "")))[0]
  }, [ages])

  // Find first unmoved lower-group team with a valid level-matched destination
  const { demoTargetIdx, demoDestIndices } = useMemo((): {
    demoTargetIdx: number
    demoDestIndices: { destIdx1: number; destIdx2: number | null; syntheticLow: boolean } | null
  } => {
    const noDemo = { demoTargetIdx: -1, demoDestIndices: null }

    // Determine upper (higher number) and lower age groups by value
    const uniqueAges = [...new Set(ages)].filter(Boolean)
    if (uniqueAges.length < 2) return noDemo
    uniqueAges.sort((a, b) => {
      const na = parseInt(a.replace("U", ""))
      const nb = parseInt(b.replace("U", ""))
      return nb - na
    })
    const upperAge = uniqueAges[0]
    const lowerAge = uniqueAges[1]

    for (let i = 0; i < visibleTeams.length; i++) {
      const team = visibleTeams[i]
      if (!team.startsWith(lowerAge) || movedTeams.has(team)) continue

      const level = extractLevelFromTeam(team)
      if (!level) continue

      const matchingUpper = upperAge + level
      const matchIdx = visibleTeams.indexOf(matchingUpper)
      if (matchIdx < 0) continue

      let destIdx1 = matchIdx + 1
      let syntheticLow = false
      if (destIdx1 >= i) {
        // Can't slot below the match — slot above it instead
        if (matchIdx > 0 && matchIdx < i) {
          destIdx1 = matchIdx
          syntheticLow = true
        } else {
          continue
        }
      }

      const destIdx2Raw = destIdx1 + 1
      const destIdx2 = destIdx2Raw < i ? destIdx2Raw : null

      return { demoTargetIdx: i, demoDestIndices: { destIdx1, destIdx2, syntheticLow } }
    }

    return noDemo
  }, [ages, visibleTeams, movedTeams])

  // Measure DOM positions for the demo animation
  useEffect(() => {
    if (mode !== "teams" || !animating || demoTargetIdx < 0 || !demoDestIndices || !listRef.current) return

    const measure = () => {
      if (!listRef.current) return
      const rows = Array.from(listRef.current.querySelectorAll<HTMLElement>(".comp-team-row"))
      if (rows.length <= demoTargetIdx) return

      const target = rows[demoTargetIdx]
      const dest1 = rows[demoDestIndices.destIdx1]
      if (!target || !dest1) return

      const shift = target.offsetHeight + 8
      const high = dest1.offsetTop - target.offsetTop
      let low = high
      if (demoDestIndices.syntheticLow) {
        // No real row below the match — compute low as one card below high
        low = high + shift
      } else if (demoDestIndices.destIdx2 !== null) {
        const dest2 = rows[demoDestIndices.destIdx2]
        if (dest2) low = dest2.offsetTop - target.offsetTop
      }
      if (high !== 0 || low !== 0) {
        setDemoOffsets({ high, low, shift })
      }
    }

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(measure)
      rafRef.current = raf2
    })
    const timeout = setTimeout(measure, 200)
    const rafRef = { current: 0 as number }

    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(rafRef.current)
      clearTimeout(timeout)
    }
  }, [mode, animating, demoTargetIdx, demoDestIndices, visibleTeams])

  // Auto-stop demo after animation completes (~25s = 5s delay + 20s anim)
  useEffect(() => {
    if (!animating || mode !== "teams") return
    demoTimerRef.current = setTimeout(() => {
      setAnimating(false)
      setDemoOffsets(null)
    }, 22000)
    return () => {
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    }
  }, [animating, demoAnimKey, mode])

  // Replay demo when replayDemoKey changes (from parent ? button)
  const prevReplayKey = useRef(replayDemoKey)
  useEffect(() => {
    if (replayDemoKey !== undefined && replayDemoKey !== prevReplayKey.current) {
      prevReplayKey.current = replayDemoKey
      setAnimating(true)
      setDemoAnimKey((k) => k + 1)
    }
  }, [replayDemoKey])

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current)
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current)
    }
  }, [])

  // Stop demo on pointer down — before dnd-kit measures rects during activation.
  // The 5px activation constraint gives React time to re-render and remove
  // animation classes before dnd-kit captures initial positions.
  const handlePointerDown = useCallback(() => {
    if (!animating) return
    setAnimating(false)
    setDemoOffsets(null)
    setDemoAnimKey((k) => k + 1)
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current)
      pauseTimerRef.current = null
    }
    if (demoTimerRef.current) {
      clearTimeout(demoTimerRef.current)
      demoTimerRef.current = null
    }
    onUserInteraction?.()
  }, [animating, onUserInteraction])

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleTeams} strategy={verticalListSortingStrategy}>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div ref={listRef} className="comp-tier-list" onPointerDown={handlePointerDown}>
            {visibleTeams.map((teamCode, idx) => {
              const currAge = ages[idx]
              const demoActive = mode === "teams" && animating && movedTeams.size < 3 && demoOffsets && demoTargetIdx >= 0
              const isDemo = demoActive && idx === demoTargetIdx

              // Determine shift group for surrounding cards
              let shiftGroup: "a" | "b" | undefined
              if (demoActive && demoDestIndices) {
                if (idx === demoDestIndices.destIdx1) shiftGroup = "a"
                else if (demoDestIndices.destIdx2 !== null && idx >= demoDestIndices.destIdx2 && idx < demoTargetIdx) shiftGroup = "b"
              }

              const needsAnimKey = isDemo || shiftGroup
              const rowKey = needsAnimKey ? `${teamCode}-d${demoAnimKey}` : teamCode

              return (
                <React.Fragment key={rowKey}>
                  <TeamRow
                    teamCode={teamCode}
                    rank={idx + 1}
                    isLowerAge={!!upperAge && currAge !== upperAge}
                    playerCount={mode === "teams" ? teamPlayerCounts[teamCode] : filteredPlayerCounts[teamCode]}
                    allPlayers={allPlayers}
                    playerOrder={effectivePlayerOrder[teamCode]}
                    pinnedPlayers={effectivePinned}
                    crewNumbers={crewNumbers}
                    missingPlayerNumbers={missingPlayerNumbers}
                    positionFilter={positionFilter}
                    positionOverrides={positionOverrides}
                    onLongPressPosition={setSwitchTarget}
                    mode={mode}
                    demoExpanded={demoExpandedTeams?.has(teamCode)}
                    demoHint={isDemo ? demoOffsets : undefined}
                    demoShift={shiftGroup}
                    demoShiftAmount={shiftGroup && demoOffsets ? demoOffsets.shift : undefined}
                  />
                </React.Fragment>
              )
            })}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeDragPlayer && (
            <PlayerCard
              player={activeDragPlayer}
              isCrew={crewNumbers.has(activeDragPlayer.number)}
              isDefense={activeDragPlayer.position === "D"}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>
      {switchTarget && onPositionOverride && (
        <PositionSwitchModal
          player={switchTarget}
          originalPosition={allPlayers.find((p) => p.number === switchTarget.number)?.position ?? switchTarget.position ?? "F"}
          onConfirm={handleConfirmSwitch}
          onClose={() => setSwitchTarget(null)}
        />
      )}
    </>
  )
}
