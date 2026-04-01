import { useCallback, useEffect, useRef, useState } from "react"
import type { PositionGroup } from "@/lib/types"

interface UsePlayerRankDemoOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  positionGroup: PositionGroup
  onSwitchPosition: (group: PositionGroup) => void
  enabled: boolean
}

interface UsePlayerRankDemoReturn {
  demoExpandedTeams: Set<string> | undefined
  demoActive: boolean
  cursorPos: { x: number; y: number }
  cursorType: "pointer" | "hand" | null
  cursorFollowing: boolean
  showLabel: boolean
  labelText: string
  pressKey: number
  onUserInteraction: () => void
}

const OPPOSITE_GROUP: Partial<Record<PositionGroup, PositionGroup>> = {
  forwards: "defense",
  defense: "forwards",
}

// Lucide Pointer icon: tip of the finger within the 28px bounding box
const POINTER_TIP_X = 4
const POINTER_TIP_Y = 1

export function usePlayerRankDemo({
  containerRef,
  positionGroup,
  onSwitchPosition,
  enabled,
}: UsePlayerRankDemoOptions): UsePlayerRankDemoReturn {
  const [demoExpandedTeams, setDemoExpandedTeams] = useState<Set<string> | undefined>(undefined)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [cursorType, setCursorType] = useState<"pointer" | "hand" | null>(null)
  const [cursorFollowing, setCursorFollowing] = useState(false)
  const [showLabel, setShowLabel] = useState(false)
  const [labelText, setLabelText] = useState("")
  const [pressKey, setPressKey] = useState(0)

  const isMounted = useRef(true)
  const stopped = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const usedPlayers = useRef<Set<number>>(new Set())
  const hasStarted = useRef(false)
  const runFullSequenceRef = useRef<() => void>(() => {})
  const expandedTeamCodes = useRef<{ team1: string; team2: string }>({ team1: "", team2: "" })

  const positionGroupRef = useRef(positionGroup)
  positionGroupRef.current = positionGroup
  const onSwitchRef = useRef(onSwitchPosition)
  onSwitchRef.current = onSwitchPosition

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      if (!isMounted.current || stopped.current) return
      fn()
    }, ms)
    timers.current.push(id)
    return id
  }, [])

  const clearAllTimers = useCallback(() => {
    for (const id of timers.current) clearTimeout(id)
    timers.current = []
  }, [])

  const cleanupDemoClasses = useCallback(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    el.querySelectorAll(".comp-player-demo-drag").forEach((n) => n.classList.remove("comp-player-demo-drag"))
    el.querySelectorAll(".comp-player-demo-shift-down").forEach((n) => n.classList.remove("comp-player-demo-shift-down"))
    el.querySelectorAll(".comp-team-demo-active").forEach((n) => {
      n.classList.remove("comp-team-demo-active")
      // Reset inline padding added during drag
      const body = n.querySelector(".comp-team-body")
      if (body instanceof HTMLElement) {
        body.style.paddingBottom = ""
        body.style.transition = ""
      }
    })
  }, [containerRef])

  // Position cursor so the Pointer icon tip lands on the element center
  const getPointerPos = useCallback((el: HTMLElement) => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const containerRect = containerRef.current.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    return {
      x: elRect.left - containerRect.left + elRect.width / 2 - POINTER_TIP_X,
      y: elRect.top - containerRect.top + elRect.height / 2 - POINTER_TIP_Y,
    }
  }, [containerRef])

  const resetState = useCallback(() => {
    cleanupDemoClasses()
    setCursorFollowing(false)
    setShowLabel(false)
    setCursorType(null)
    setDemoExpandedTeams(undefined)
    if (containerRef.current) {
      containerRef.current.style.removeProperty("--pdemo-target-y")
      containerRef.current.style.removeProperty("--pdemo-shift")
      containerRef.current.style.removeProperty("--pdemo-cursor-x")
      containerRef.current.style.removeProperty("--pdemo-cursor-y")
    }
  }, [containerRef, cleanupDemoClasses])

  const onUserInteraction = useCallback(() => {
    stopped.current = true
    clearAllTimers()
    resetState()
  }, [clearAllTimers, resetState])

  // Phase 5: Full cleanup → wait 15s → repeat
  const runFinalCleanup = useCallback(() => {
    resetState()
    if (!stopped.current) {
      schedule(() => {
        if (stopped.current || !isMounted.current) return
        runFullSequenceRef.current()
      }, 15000)
    }
  }, [resetState, schedule])

  // Phase 4: Collapse teams gracefully, then fade cursor
  const runCollapse = useCallback(() => {
    if (!containerRef.current || stopped.current) {
      runFinalCleanup()
      return
    }

    const { team1, team2 } = expandedTeamCodes.current
    const header2 = containerRef.current.querySelector<HTMLElement>(`[data-team-header="${team2}"]`)
    const header1 = containerRef.current.querySelector<HTMLElement>(`[data-team-header="${team1}"]`)

    if (!header2 || !header1) {
      runFinalCleanup()
      return
    }

    // Hand → pointer
    setCursorType("pointer")
    setCursorFollowing(false)

    // Move to team 2 header
    schedule(() => {
      const pos = getPointerPos(header2)
      setCursorPos(pos)
    }, 200)

    // Collapse team 2
    schedule(() => {
      setPressKey((k) => k + 1)
      setDemoExpandedTeams(new Set([team1]))
    }, 1000)

    // Move to team 1 header
    schedule(() => {
      const pos = getPointerPos(header1)
      setCursorPos(pos)
    }, 1600)

    // Collapse team 1
    schedule(() => {
      setPressKey((k) => k + 1)
      setDemoExpandedTeams(new Set())
    }, 2200)

    // Fade cursor
    schedule(() => {
      setCursorType(null)
    }, 2800)

    // Final cleanup
    schedule(() => {
      runFinalCleanup()
    }, 3200)
  }, [containerRef, getPointerPos, schedule, runFinalCleanup])

  // Phase 3: Player drag (no jiggle — drag up, hold, return)
  const runDrag = useCallback(() => {
    if (!containerRef.current || stopped.current) return

    schedule(() => {
      if (!containerRef.current || stopped.current) return

      const teamEls = containerRef.current.querySelectorAll<HTMLElement>("[data-team]")
      if (teamEls.length < 2) {
        runCollapse()
        return
      }

      const team1El = teamEls[0]
      const team2El = teamEls[1]

      const team2Players = team2El.querySelectorAll<HTMLElement>("[data-player-number]")
      if (team2Players.length < 2) {
        runCollapse()
        return
      }

      // Pick random player (not first, not previously used)
      const candidates: HTMLElement[] = []
      for (let i = 1; i < team2Players.length && i < 4; i++) {
        const num = Number(team2Players[i].getAttribute("data-player-number"))
        if (!usedPlayers.current.has(num)) {
          candidates.push(team2Players[i])
        }
      }
      if (candidates.length === 0) {
        usedPlayers.current.clear()
        for (let i = 1; i < team2Players.length && i < 4; i++) {
          candidates.push(team2Players[i])
        }
      }
      if (candidates.length === 0) {
        runCollapse()
        return
      }

      const sourcePlayer = candidates[Math.floor(Math.random() * candidates.length)]
      const sourceNum = Number(sourcePlayer.getAttribute("data-player-number"))
      usedPlayers.current.add(sourceNum)

      const team1Players = team1El.querySelectorAll<HTMLElement>("[data-player-number]")
      const targetIdx = Math.min(Math.floor(team1Players.length / 2), team1Players.length - 1)

      // Measure
      const sourceRect = sourcePlayer.getBoundingClientRect()
      const containerRect = containerRef.current.getBoundingClientRect()

      let targetY = 0
      if (team1Players.length > 0 && targetIdx >= 0) {
        const targetPlayer = team1Players[targetIdx]
        const targetRect = targetPlayer.getBoundingClientRect()
        targetY = targetRect.top - sourceRect.top
      }

      const playerHeight = sourceRect.height + 4

      // Cursor grip position on source player
      const cursorX = sourceRect.left - containerRect.left + 10
      const cursorY = sourceRect.top - containerRect.top + sourceRect.height / 2 - 14

      // Set CSS variables with original (pre-expansion) values
      containerRef.current.style.setProperty("--pdemo-target-y", `${targetY}px`)
      containerRef.current.style.setProperty("--pdemo-shift", `${playerHeight}px`)
      containerRef.current.style.setProperty("--pdemo-cursor-x", `${cursorX}px`)
      containerRef.current.style.setProperty("--pdemo-cursor-y", `${cursorY}px`)

      // Enable overflow on both team rows
      team2El.classList.add("comp-team-demo-active")
      team1El.classList.add("comp-team-demo-active")

      // Move cursor to source player
      setCursorPos({ x: cursorX, y: cursorY })

      // Hand cursor
      schedule(() => {
        setCursorType("hand")
      }, 300)

      // Start drag + shift-down animations (no expansion yet)
      schedule(() => {
        sourcePlayer.classList.add("comp-player-demo-drag")
        setCursorFollowing(true)
        setShowLabel(true)
        setLabelText("Where would you place this player?")

        // Shift down players in team 1 below insertion point
        for (let i = targetIdx; i < team1Players.length; i++) {
          team1Players[i].classList.add("comp-player-demo-shift-down")
        }
      }, 800)

      // Expand card once the player is moving (12% of 10s = 1.2s after anim start).
      // Updating CSS vars in the same frame compensates for the layout shift
      // so neither the player nor cursor visually jump.
      schedule(() => {
        if (!containerRef.current) return
        const team1Body = team1El.querySelector(".comp-team-body")
        if (team1Body instanceof HTMLElement) {
          const currentPad = parseFloat(getComputedStyle(team1Body).paddingBottom) || 0
          team1Body.style.paddingBottom = `${currentPad + playerHeight}px`
        }
        containerRef.current.style.setProperty("--pdemo-target-y", `${targetY - playerHeight}px`)
        containerRef.current.style.setProperty("--pdemo-cursor-y", `${cursorY + playerHeight}px`)
      }, 2000)

      // At 65% of 10s (6.5s + 0.8s = 7.3s): player has returned to source.
      // Stop following and park cursor at post-expansion position.
      schedule(() => {
        if (!containerRef.current) return
        containerRef.current.querySelectorAll(".comp-player-demo-drag").forEach((n) =>
          n.classList.remove("comp-player-demo-drag"))
        containerRef.current.querySelectorAll(".comp-player-demo-shift-down").forEach((n) =>
          n.classList.remove("comp-player-demo-shift-down"))
        setShowLabel(false)
        setCursorPos({ x: cursorX, y: cursorY + playerHeight })
        setCursorFollowing(false)
      }, 7300)

      // Contract card + move cursor together so hand follows the player up
      schedule(() => {
        setCursorPos({ x: cursorX, y: cursorY })
        if (!containerRef.current) return
        containerRef.current.querySelectorAll(".comp-team-demo-active").forEach((n) => {
          const body = n.querySelector(".comp-team-body")
          if (body instanceof HTMLElement) {
            body.style.transition = "padding-bottom 0.3s ease"
            body.style.paddingBottom = ""
          }
        })
      }, 7600)

      // Clean up transition styles, then → Phase 4: Collapse
      schedule(() => {
        if (!containerRef.current) return
        containerRef.current.querySelectorAll(".comp-team-demo-active").forEach((n) => {
          n.classList.remove("comp-team-demo-active")
          const body = n.querySelector(".comp-team-body")
          if (body instanceof HTMLElement) {
            body.style.transition = ""
          }
        })
        runCollapse()
      }, 8000)
    }, 500)
  }, [containerRef, schedule, runCollapse, cleanupDemoClasses])

  // Phase 2: Expand teams
  const runExpand = useCallback(() => {
    if (!containerRef.current || stopped.current) return

    schedule(() => {
      if (!containerRef.current || stopped.current) return

      const headers = containerRef.current.querySelectorAll<HTMLElement>("[data-team-header]")
      if (headers.length < 2) {
        runDrag()
        return
      }

      const header1 = headers[0]
      const header2 = headers[1]
      const team1 = header1.getAttribute("data-team-header") || ""
      const team2 = header2.getAttribute("data-team-header") || ""
      expandedTeamCodes.current = { team1, team2 }

      const pos1 = getPointerPos(header1)
      setCursorPos(pos1)

      schedule(() => {
        setPressKey((k) => k + 1)
        setDemoExpandedTeams(new Set([team1]))
      }, 800)

      schedule(() => {
        const pos2 = getPointerPos(header2)
        setCursorPos(pos2)
      }, 1600)

      schedule(() => {
        setPressKey((k) => k + 1)
        setDemoExpandedTeams(new Set([team1, team2]))
      }, 2400)

      schedule(() => {
        runDrag()
      }, 3000)
    }, 300)
  }, [containerRef, getPointerPos, schedule, runDrag])

  // Phase 1: Tab demo
  const runTabs = useCallback(() => {
    if (!containerRef.current || stopped.current) return

    const group = positionGroupRef.current
    const opposite = OPPOSITE_GROUP[group]
    if (!opposite) {
      runExpand()
      return
    }

    const tabs = containerRef.current.querySelectorAll<HTMLElement>(".results-position-tab")
    if (tabs.length < 2) {
      runExpand()
      return
    }

    const tabArr = Array.from(tabs)
    const oppositeLabel = opposite === "forwards" ? "Forwards" : "Defense"
    const currentLabel = group === "forwards" ? "Forwards" : "Defense"
    const oppositeTab = tabArr.find((t) => t.textContent?.trim() === oppositeLabel)
    const currentTab = tabArr.find((t) => t.textContent?.trim() === currentLabel)

    if (!oppositeTab || !currentTab) {
      runExpand()
      return
    }

    setCursorType("pointer")
    const startPos = getPointerPos(currentTab)
    setCursorPos(startPos)

    schedule(() => {
      const pos = getPointerPos(oppositeTab)
      setCursorPos(pos)
    }, 600)

    schedule(() => {
      setPressKey((k) => k + 1)
      onSwitchRef.current(opposite)
    }, 1400)

    schedule(() => {
      const pos = getPointerPos(currentTab)
      setCursorPos(pos)
    }, 2400)

    schedule(() => {
      setPressKey((k) => k + 1)
      onSwitchRef.current(group)
    }, 3200)

    schedule(() => {
      runExpand()
    }, 4000)
  }, [containerRef, getPointerPos, schedule, runExpand])

  const runFullSequence = useCallback(() => {
    if (stopped.current || !isMounted.current) return
    runTabs()
  }, [runTabs])
  runFullSequenceRef.current = runFullSequence

  // Start demo on mount
  useEffect(() => {
    if (!enabled || hasStarted.current) return
    hasStarted.current = true

    const id = setTimeout(() => {
      if (!isMounted.current || stopped.current) return
      runFullSequence()
    }, 1500)
    timers.current.push(id)
  }, [enabled, runFullSequence])

  // Mount/unmount
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      hasStarted.current = false
      stopped.current = false
      clearAllTimers()
      cleanupDemoClasses()
    }
  }, [clearAllTimers, cleanupDemoClasses])

  return {
    demoExpandedTeams,
    demoActive: cursorType !== null,
    cursorPos,
    cursorType,
    cursorFollowing,
    showLabel,
    labelText,
    pressKey,
    onUserInteraction,
  }
}
