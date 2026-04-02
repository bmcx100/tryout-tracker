"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { StepRankTeams } from "./step-rank-teams"
import { StepRankPlayers } from "./step-rank-players"
import { ResultsView } from "./results-view"
import { ResetConfirmModal } from "@/components/competition/reset-confirm-modal"
import type {
  Player,
  UserCompetitionPrefs,
  PinnedPlayer,
  CrewMember,
  PositionGroup,
} from "@/lib/types"
import { DEFAULT_TEAM_ORDER } from "@/lib/utils"
import {
  updateTeamOrder,
  updatePlayerOrder,
  updateTeamSlots,
  updatePositionOverrides,
  pinPlayer,
  markLastViewed,
  resetPrefs,
} from "@/lib/actions/competition-prefs"

type WizardStep = "rank" | "rank-players" | "done"

const POSITION_MAP: Record<string, "F" | "D" | "G" | "ALL"> = {
  all: "ALL",
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const POSITION_LABEL: Record<string, string> = {
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
}

const defaultPrefs: UserCompetitionPrefs = {
  id: "",
  user_id: "",
  position_group: "forwards",
  team_order: [],
  player_order: {},
  pinned_players: {},
  team_slots: {},
  position_overrides: {},
  last_viewed: "",
  created_at: "",
  updated_at: "",
}

export default function HomePage() {
  const { activeOrgId } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Global team order (shared across all positions)
  const [globalTeamOrder, setGlobalTeamOrder] = useState<string[]>([])
  const [globalPlayerOrder, setGlobalPlayerOrder] = useState<Record<string, number[]>>({})
  const [globalPinnedPlayers, setGlobalPinnedPlayers] = useState<Record<string, PinnedPlayer>>({})

  // Per-position prefs (player_order rt: keys, team_slots)
  const [allPrefs, setAllPrefs] = useState<UserCompetitionPrefs[]>([])
  const [currentPrefs, setCurrentPrefs] = useState<UserCompetitionPrefs>(defaultPrefs)

  // Wizard state
  const [step, setStep] = useState<WizardStep>("rank")
  const [activeGroup, setActiveGroup] = useState<PositionGroup>("forwards")
  const [resetModal, setResetModal] = useState<{
    title: string
    items: string[]
    onConfirm: () => void
  } | null>(null)

  // Fast position lookup for splitting "all" tab reorders by position
  // Incorporates position overrides so drag-and-drop on "all" tab routes correctly
  const playerPositionMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of players) {
      if (p.position) map[p.number] = p.position
    }
    const overrides = currentPrefs.position_overrides || {}
    for (const [numStr, pos] of Object.entries(overrides)) {
      map[Number(numStr)] = pos
    }
    return map
  }, [players, currentPrefs.position_overrides])

  useEffect(() => {
    if (!activeOrgId) return

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const load = async () => {
      try {
        const supabase = createClient()

        const [playersRes, prefsRes, crewRes] = await Promise.all([
          supabase
            .from("players_view")
            .select("*")
            .eq("org_id", activeOrgId)
            .not("position", "is", null)
            .not("previous_team", "is", null)
            .abortSignal(controller.signal),
          supabase
            .from("user_competition_prefs")
            .select("*")
            .eq("org_id", activeOrgId)
            .order("last_viewed", { ascending: false })
            .abortSignal(controller.signal),
          supabase
            .from("user_crew")
            .select("*")
            .eq("org_id", activeOrgId)
            .abortSignal(controller.signal),
        ])

        if (playersRes.error) throw new Error(playersRes.error.message)
        setPlayers(playersRes.data || [])
        if (crewRes.data) setCrew(crewRes.data)

        const prefs = (prefsRes.data || []) as UserCompetitionPrefs[]
        const globalRow = prefs.find((p) => p.position_group === "global")
        const positionPrefs = prefs.filter(
          (p) => p.position_group !== "global" && p.position_group !== "all"
        )

        // Clean up legacy "all" rows (now derived from individual tabs)
        const legacyAllRow = prefs.find((p) => p.position_group === "all")
        if (legacyAllRow) {
          resetPrefs("all").catch(() => {})
        }

        // Determine global team order
        let initTeamOrder: string[] = []
        if (globalRow?.team_order?.length) {
          initTeamOrder = globalRow.team_order
        } else if (positionPrefs.length > 0 && positionPrefs[0].team_order?.length) {
          initTeamOrder = positionPrefs[0].team_order
        }
        setGlobalTeamOrder(initTeamOrder)

        // Determine global player order and pinned players
        if (globalRow) {
          setGlobalPlayerOrder(globalRow.player_order || {})
          setGlobalPinnedPlayers(globalRow.pinned_players || {})
        } else if (positionPrefs.length > 0) {
          const first = positionPrefs[0]
          const nonRt: Record<string, number[]> = {}
          for (const [key, val] of Object.entries(first.player_order || {})) {
            if (!key.startsWith("rt:")) nonRt[key] = val
          }
          setGlobalPlayerOrder(nonRt)
          setGlobalPinnedPlayers(first.pinned_players || {})
        }

        setAllPrefs(positionPrefs)

        // If user has any sorting done, show results view
        if (initTeamOrder.length > 0 || positionPrefs.length > 0) {
          const mostRecent = positionPrefs[0]
          if (mostRecent) {
            setCurrentPrefs(mostRecent)
            setActiveGroup(mostRecent.position_group as PositionGroup)
          } else {
            setActiveGroup("forwards")
            setCurrentPrefs({ ...defaultPrefs, position_group: "forwards" })
          }
          setStep("done")
        }

        setLoading(false)
      } catch (err) {
        if (controller.signal.aborted) {
          setError("Request timed out — try refreshing the page")
        } else {
          console.error("Home load error:", err)
          setError(err instanceof Error ? err.message : "Failed to load")
        }
        setLoading(false)
      } finally {
        clearTimeout(timer)
      }
    }
    load()

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [activeOrgId])

  const crewNumbers = new Set(crew.map((c) => c.player_number))

  const teamOrder = globalTeamOrder.length
    ? globalTeamOrder
    : DEFAULT_TEAM_ORDER

  const positionFilter = POSITION_MAP[activeGroup] || "ALL"

  // Group players by previous_team for the rank step
  const playersByTeam: Record<string, Player[]> = {}
  for (const p of players) {
    const team = p.previous_team || "Unknown"
    if (!playersByTeam[team]) playersByTeam[team] = []
    playersByTeam[team].push(p)
  }
  for (const team of Object.keys(playersByTeam)) {
    const customOrder = globalPlayerOrder[team]
    if (customOrder?.length) {
      playersByTeam[team].sort((a, b) => {
        const ai = customOrder.indexOf(a.number)
        const bi = customOrder.indexOf(b.number)
        if (ai === -1 && bi === -1) return a.number - b.number
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    } else {
      playersByTeam[team].sort((a, b) => a.number - b.number)
    }
  }

  // --- Rank step handlers (save to "global") ---

  const handleTeamReorder = useCallback(
    async (newOrder: string[]) => {
      setGlobalTeamOrder(newOrder)
      try {
        await updateTeamOrder(newOrder)
      } catch (err) {
        console.error("Failed to save team order:", err)
      }
    },
    []
  )

  const handleRankPlayerReorder = useCallback(
    async (team: string, playerNumbers: number[]) => {
      setGlobalPlayerOrder((prev) => ({ ...prev, [team]: playerNumbers }))
      try {
        await updatePlayerOrder("global", team, playerNumbers)
      } catch (err) {
        console.error("Failed to save player order:", err)
      }
    },
    []
  )

  const handleRankPinToTeam = useCallback(
    async (playerNumber: number, targetTeam: string, pos: number) => {
      setGlobalPinnedPlayers((prev) => ({
        ...prev,
        [String(playerNumber)]: { team: targetTeam, position: pos },
      }))
      try {
        await pinPlayer("global", playerNumber, targetTeam, pos)
      } catch (err) {
        console.error("Failed to pin player:", err)
      }
    },
    []
  )

  const handleTeamOrderReset = useCallback(async () => {
    setGlobalTeamOrder([])
    try {
      await updateTeamOrder([])
    } catch (err) {
      console.error("Failed to reset team order:", err)
    }
  }, [])

  const handleRankReset = useCallback(() => {
    const posCode = POSITION_MAP[activeGroup]
    const label = POSITION_LABEL[activeGroup] || activeGroup
    setResetModal({
      title: `Reset ${label} Rankings`,
      items: [
        `${label} player order`,
        `${label} moved between teams`,
      ],
      onConfirm: async () => {
        setResetModal(null)
        // Filter out only players matching the active position
        const posNums = new Set(
          players
            .filter((p) => (playerPositionMap[p.number] || p.position) === posCode)
            .map((p) => p.number)
        )
        setGlobalPlayerOrder((prev) => {
          const next: Record<string, number[]> = {}
          for (const [team, nums] of Object.entries(prev)) {
            const filtered = nums.filter((n) => !posNums.has(n))
            if (filtered.length > 0) next[team] = filtered
          }
          return next
        })
        setGlobalPinnedPlayers((prev) => {
          const next: Record<string, PinnedPlayer> = {}
          for (const [key, val] of Object.entries(prev)) {
            if (!posNums.has(Number(key))) next[key] = val
          }
          return next
        })
        try {
          await resetPrefs("global")
        } catch (err) {
          console.error("Failed to reset rank position:", err)
        }
      },
    })
  }, [activeGroup, players, playerPositionMap])

  const handleRankResetAll = useCallback(() => {
    setResetModal({
      title: "Reset All Rankings",
      items: [
        "Team order",
        "All player order",
        "Players moved between teams",
        "F/D position switches",
      ],
      onConfirm: async () => {
        setResetModal(null)
        setGlobalTeamOrder([])
        setGlobalPlayerOrder({})
        setGlobalPinnedPlayers({})
        setCurrentPrefs((prev) => ({ ...prev, position_overrides: {} }))
        try {
          await Promise.all([
            resetPrefs("global"),
            resetPrefs("forwards"),
            resetPrefs("defense"),
            resetPrefs("goalies"),
          ])
        } catch (err) {
          console.error("Failed to reset all:", err)
        }
        setAllPrefs((prev) => prev.filter(
          (p) => p.position_group !== "forwards"
            && p.position_group !== "defense"
            && p.position_group !== "goalies"
        ))
      },
    })
  }, [])

  const handleRankPositionSwitch = useCallback((group: PositionGroup) => {
    if (group === "global") return
    setActiveGroup(group)
  }, [])

  const handleWizardTeamsDone = useCallback(() => {
    setStep("rank-players")
  }, [])

  const handleWizardPlayersDone = useCallback(() => {
    setStep("done")
  }, [])

  const handleBackToTeams = useCallback(() => {
    setStep("rank")
  }, [])

  // --- Helpers for derived "all" tab ---

  const buildDerivedAllPlayerOrder = useCallback(
    (prefsArray: UserCompetitionPrefs[]): Record<string, number[]> => {
      const fwdPrefs = prefsArray.find((p) => p.position_group === "forwards")
      const defPrefs = prefsArray.find((p) => p.position_group === "defense")
      const goaPrefs = prefsArray.find((p) => p.position_group === "goalies")

      const rtKeys = new Set<string>()
      for (const prefs of [fwdPrefs, defPrefs, goaPrefs]) {
        if (!prefs?.player_order) continue
        for (const key of Object.keys(prefs.player_order)) {
          if (key.startsWith("rt:")) rtKeys.add(key)
        }
      }

      const merged: Record<string, number[]> = {}
      for (const rtKey of rtKeys) {
        merged[rtKey] = [
          ...(fwdPrefs?.player_order?.[rtKey] || []),
          ...(defPrefs?.player_order?.[rtKey] || []),
          ...(goaPrefs?.player_order?.[rtKey] || []),
        ]
      }
      return merged
    },
    []
  )

  const splitByPosition = useCallback(
    (playerNumbers: number[]): { forwards: number[]; defense: number[]; goalies: number[] } => {
      const forwards: number[] = []
      const defense: number[] = []
      const goalies: number[] = []
      for (const num of playerNumbers) {
        const pos = playerPositionMap[num]
        if (pos === "F") forwards.push(num)
        else if (pos === "D") defense.push(num)
        else if (pos === "G") goalies.push(num)
      }
      return { forwards, defense, goalies }
    },
    [playerPositionMap]
  )

  // --- Results step handlers (save per-position) ---

  const handleResultsPlayerReorder = useCallback(
    async (team: string, playerNumbers: number[]) => {
      // Update currentPrefs for immediate UI feedback
      setCurrentPrefs((prev) => ({
        ...prev,
        player_order: { ...prev.player_order, [team]: playerNumbers },
      }))

      if (activeGroup === "all") {
        // Split the mixed-position array and save to each individual tab
        const { forwards, defense, goalies } = splitByPosition(playerNumbers)
        const updates: { group: PositionGroup; nums: number[] }[] = [
          { group: "forwards", nums: forwards },
          { group: "defense", nums: defense },
          { group: "goalies", nums: goalies },
        ]

        setAllPrefs((prev) => {
          const next = [...prev]
          for (const { group, nums } of updates) {
            const idx = next.findIndex((p) => p.position_group === group)
            if (idx >= 0) {
              next[idx] = { ...next[idx], player_order: { ...next[idx].player_order, [team]: nums } }
            } else if (nums.length > 0) {
              next.push({ ...defaultPrefs, position_group: group, player_order: { [team]: nums } })
            }
          }
          return next
        })

        try {
          await Promise.all(
            updates
              .filter(({ nums }) => nums.length > 0)
              .map(({ group, nums }) => updatePlayerOrder(group, team, nums))
          )
        } catch (err) {
          console.error("Failed to save player order:", err)
        }
      } else {
        // Single position tab — save to that position
        setAllPrefs((prev) => {
          const idx = prev.findIndex((p) => p.position_group === activeGroup)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = { ...next[idx], player_order: { ...next[idx].player_order, [team]: playerNumbers } }
            return next
          }
          return [...prev, { ...defaultPrefs, position_group: activeGroup, player_order: { [team]: playerNumbers } }]
        })

        try {
          await updatePlayerOrder(activeGroup, team, playerNumbers)
        } catch (err) {
          console.error("Failed to save player order:", err)
        }
      }
    },
    [activeGroup, splitByPosition]
  )

  const handleUpdateTeamSlots = useCallback(
    async (teamCode: string, slots: Record<string, number> | null) => {
      const applySlots = (ts: Record<string, Record<string, number>>) => {
        const next = { ...ts }
        if (slots) {
          next[teamCode] = slots
        } else {
          delete next[teamCode]
        }
        return next
      }
      setCurrentPrefs((prev) => ({ ...prev, team_slots: applySlots(prev.team_slots) }))

      // Sync team_slots to all three position tabs (slots are position-agnostic)
      const positionGroups: PositionGroup[] = ["forwards", "defense", "goalies"]
      setAllPrefs((prev) => {
        const next = [...prev]
        for (const group of positionGroups) {
          const idx = next.findIndex((p) => p.position_group === group)
          if (idx >= 0) {
            next[idx] = { ...next[idx], team_slots: applySlots(next[idx].team_slots || {}) }
          } else {
            next.push({ ...defaultPrefs, position_group: group, team_slots: applySlots({}) })
          }
        }
        return next
      })

      try {
        await Promise.all(
          positionGroups.map((group) => updateTeamSlots(group, teamCode, slots))
        )
      } catch (err) {
        console.error("Failed to save team slots:", err)
      }
    },
    []
  )

  const handlePositionOverride = useCallback(
    async (playerNumber: number, newPosition: string | null) => {
      // Update local state
      setCurrentPrefs((prev) => {
        const overrides = { ...prev.position_overrides }
        if (newPosition) {
          overrides[String(playerNumber)] = newPosition
        } else {
          delete overrides[String(playerNumber)]
        }
        return { ...prev, position_overrides: overrides }
      })

      // Sync to all three position group rows (like team_slots)
      const positionGroups: PositionGroup[] = ["forwards", "defense", "goalies"]
      setAllPrefs((prev) => {
        const next = [...prev]
        for (const group of positionGroups) {
          const idx = next.findIndex((p) => p.position_group === group)
          if (idx >= 0) {
            const overrides = { ...next[idx].position_overrides }
            if (newPosition) {
              overrides[String(playerNumber)] = newPosition
            } else {
              delete overrides[String(playerNumber)]
            }
            next[idx] = { ...next[idx], position_overrides: overrides }
          } else if (newPosition) {
            next.push({ ...defaultPrefs, position_group: group, position_overrides: { [String(playerNumber)]: newPosition } })
          }
        }
        return next
      })

      // Save to DB for all three position groups
      try {
        await Promise.all(
          positionGroups.map((group) =>
            updatePositionOverrides(group, playerNumber, newPosition)
          )
        )
      } catch (err) {
        console.error("Failed to save position override:", err)
      }
    },
    []
  )

  const handleResultsResetAll = useCallback(() => {
    setResetModal({
      title: "Reset All Results",
      items: [
        "All player order",
        "Players moved between teams",
        "Team roster slots",
        "F/D position switches",
      ],
      onConfirm: async () => {
        setResetModal(null)
        setCurrentPrefs((prev) => ({
          ...prev,
          player_order: {},
          pinned_players: {},
          team_slots: {},
          position_overrides: {},
        }))
        try {
          await Promise.all([
            resetPrefs("forwards"),
            resetPrefs("defense"),
            resetPrefs("goalies"),
          ])
        } catch (err) {
          console.error("Failed to reset all:", err)
        }
        setAllPrefs((prev) => prev.filter(
          (p) => p.position_group !== "forwards"
            && p.position_group !== "defense"
            && p.position_group !== "goalies"
        ))
      },
    })
  }, [])

  const handleResultsReset = useCallback(() => {
    if (activeGroup === "all") {
      handleResultsResetAll()
      return
    }
    const label = POSITION_LABEL[activeGroup] || activeGroup
    setResetModal({
      title: `Reset ${label} Results`,
      items: [
        `${label} player order`,
        `${label} moved between teams`,
      ],
      onConfirm: async () => {
        setResetModal(null)
        setCurrentPrefs((prev) => ({
          ...prev,
          player_order: {},
          pinned_players: {},
        }))
        try {
          await resetPrefs(activeGroup)
        } catch (err) {
          console.error("Failed to reset:", err)
        }
        setAllPrefs((prev) => prev.filter((p) => p.position_group !== activeGroup))
      },
    })
  }, [activeGroup, handleResultsResetAll])

  const handleRunSorter = useCallback(() => {
    if (activeGroup === "all") setActiveGroup("forwards")
    setStep("rank")
  }, [activeGroup])

  const handleResultsPositionSwitch = useCallback(
    (group: PositionGroup) => {
      if (group === "global") return
      setActiveGroup(group)

      if (group === "all") {
        // Derive "all" from the three individual position tabs
        const derivedPlayerOrder = buildDerivedAllPlayerOrder(allPrefs)
        const anyPrefs = allPrefs.find(
          (p) => p.position_group === "forwards"
            || p.position_group === "defense"
            || p.position_group === "goalies"
        )
        setCurrentPrefs({
          ...defaultPrefs,
          position_group: "all",
          player_order: derivedPlayerOrder,
          team_slots: anyPrefs?.team_slots || {},
          position_overrides: anyPrefs?.position_overrides || {},
        })
      } else {
        const existing = allPrefs.find((p) => p.position_group === group)
        if (existing) {
          setCurrentPrefs(existing)
        } else {
          setCurrentPrefs({ ...defaultPrefs, position_group: group })
        }
        markLastViewed(group).catch((err) => console.error("Failed to mark last viewed:", err))
      }
    },
    [allPrefs, buildDerivedAllPlayerOrder]
  )

  if (loading) {
    return (
      <div className="app-page">
        <div className="home-loading">
          <div className="loading-dots">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <p className="home-loading-text">Loading players...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-page">
        <div className="app-empty-state">
          <p className="app-empty-title">Something went wrong</p>
          <p className="app-empty-desc">{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Merged player order for results view: global non-rt: keys + per-position rt: keys
  const resultsPlayerOrderMap = {
    ...globalPlayerOrder,
    ...(currentPrefs.player_order || {}),
  }

  if (step === "rank") {
    return (
      <div className="app-page">
        <StepRankTeams
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={players}
          playerOrderMap={globalPlayerOrder}
          pinnedPlayers={globalPinnedPlayers}
          crewNumbers={crewNumbers}
          positionFilter={positionFilter}
          positionOverrides={currentPrefs.position_overrides || {}}
          onTeamReorder={handleTeamReorder}
          onPlayerReorder={handleRankPlayerReorder}
          onPinToTeam={handleRankPinToTeam}
          onPositionOverride={handlePositionOverride}
          onReset={handleTeamOrderReset}
          onNext={handleWizardTeamsDone}
        />
        {resetModal && (
          <ResetConfirmModal
            title={resetModal.title}
            items={resetModal.items}
            onConfirm={resetModal.onConfirm}
            onCancel={() => setResetModal(null)}
          />
        )}
      </div>
    )
  }

  if (step === "rank-players") {
    return (
      <div className="app-page">
        <StepRankPlayers
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={players}
          playerOrderMap={globalPlayerOrder}
          pinnedPlayers={globalPinnedPlayers}
          crewNumbers={crewNumbers}
          positionFilter={positionFilter}
          positionGroup={activeGroup}
          positionOverrides={currentPrefs.position_overrides || {}}
          onPlayerReorder={handleRankPlayerReorder}
          onPinToTeam={handleRankPinToTeam}
          onPositionOverride={handlePositionOverride}
          onReset={handleRankReset}
          onResetAll={handleRankResetAll}
          onNext={handleWizardPlayersDone}
          onBack={handleBackToTeams}
          onSwitchPosition={handleRankPositionSwitch}
        />
        {resetModal && (
          <ResetConfirmModal
            title={resetModal.title}
            items={resetModal.items}
            onConfirm={resetModal.onConfirm}
            onCancel={() => setResetModal(null)}
          />
        )}
      </div>
    )
  }

  // step === "done" — results view
  return (
    <>
      <ResultsView
        positionGroup={activeGroup}
        teamOrder={teamOrder}
        players={players}
        pinnedPlayers={globalPinnedPlayers}
        playerOrderMap={resultsPlayerOrderMap}
        teamSlots={currentPrefs.team_slots || {}}
        crewNumbers={crewNumbers}
        positionOverrides={currentPrefs.position_overrides || {}}
        onReorder={handleResultsPlayerReorder}
        onUpdateTeamSlots={handleUpdateTeamSlots}
        onPositionOverride={handlePositionOverride}
        onReset={handleResultsReset}
        onResetAll={handleResultsResetAll}
        onRunSorter={handleRunSorter}
        onSwitchPosition={handleResultsPositionSwitch}
      />
      {resetModal && (
        <ResetConfirmModal
          title={resetModal.title}
          items={resetModal.items}
          onConfirm={resetModal.onConfirm}
          onCancel={() => setResetModal(null)}
        />
      )}
    </>
  )
}
