import { useCallback, useEffect, useRef, useState } from "react"

interface UsePlayerRankDemoOptions {
  containerRef: React.RefObject<HTMLDivElement | null>
  enabled: boolean
  skipDemo?: boolean
}

interface UsePlayerRankDemoReturn {
  demoExpandedTeams: Set<string> | undefined
  demoActive: boolean
  cursorPos: { x: number; y: number }
  cursorType: "pointer" | null
  pressKey: number
  onUserInteraction: () => void
  restart: () => void
}

// Lucide Pointer icon: tip of the finger within the 28px bounding box
const POINTER_TIP_X = 4
const POINTER_TIP_Y = 1

export function usePlayerRankDemo({
  containerRef,
  enabled,
  skipDemo,
}: UsePlayerRankDemoOptions): UsePlayerRankDemoReturn {
  const [demoExpandedTeams, setDemoExpandedTeams] = useState<Set<string> | undefined>(undefined)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [cursorType, setCursorType] = useState<"pointer" | null>(null)
  const [pressKey, setPressKey] = useState(0)

  const isMounted = useRef(true)
  const stopped = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const hasStarted = useRef(false)

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
    setCursorType(null)
    setDemoExpandedTeams(undefined)
  }, [])

  const onUserInteraction = useCallback(() => {
    stopped.current = true
    clearAllTimers()
    resetState()
  }, [clearAllTimers, resetState])

  // Demo: pointer appears, clicks top two teams to expand, then disappears
  const runExpandDemo = useCallback(() => {
    if (!containerRef.current || stopped.current) return

    const headers = containerRef.current.querySelectorAll<HTMLElement>("[data-team-header]")
    if (headers.length < 2) return

    const header1 = headers[0]
    const header2 = headers[1]
    const team1 = header1.getAttribute("data-team-header") || ""
    const team2 = header2.getAttribute("data-team-header") || ""

    // Show pointer at team 1 immediately
    setCursorType("pointer")
    const pos1 = getPointerPos(header1)
    setCursorPos(pos1)

    // Click team 1
    schedule(() => {
      setPressKey((k) => k + 1)
      setDemoExpandedTeams(new Set([team1]))
    }, 600)

    // Move to team 2
    schedule(() => {
      const pos2 = getPointerPos(header2)
      setCursorPos(pos2)
    }, 1200)

    // Click team 2
    schedule(() => {
      setPressKey((k) => k + 1)
      setDemoExpandedTeams(new Set([team1, team2]))
    }, 1800)

    // Fade out cursor
    schedule(() => {
      setCursorType(null)
    }, 2600)
  }, [containerRef, getPointerPos, schedule])

  const restart = useCallback(() => {
    clearAllTimers()
    resetState()
    stopped.current = false
    const id = setTimeout(() => {
      if (!isMounted.current || stopped.current) return
      runExpandDemo()
    }, 300)
    timers.current.push(id)
  }, [clearAllTimers, resetState, runExpandDemo])

  // Start demo on mount
  useEffect(() => {
    if (!enabled || hasStarted.current || skipDemo) return
    hasStarted.current = true

    const id = setTimeout(() => {
      if (!isMounted.current || stopped.current) return
      runExpandDemo()
    }, 300)
    timers.current.push(id)
  }, [enabled, skipDemo, runExpandDemo])

  // Mount/unmount
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      hasStarted.current = false
      stopped.current = false
      clearAllTimers()
    }
  }, [clearAllTimers])

  return {
    demoExpandedTeams,
    demoActive: cursorType !== null,
    cursorPos,
    cursorType,
    pressKey,
    onUserInteraction,
    restart,
  }
}
