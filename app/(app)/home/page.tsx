"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { StepPosition } from "./step-position"
import { StepRankTeams } from "./step-rank-teams"
import { StepResults } from "./step-results"
import { ResultsView } from "./results-view"
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
  pinPlayer,
  unpinPlayer,
  markLastViewed,
} from "@/lib/actions/competition-prefs"

type WizardStep = "position" | "rank" | "results" | "done"

const POSITION_FILTER: Record<PositionGroup, string> = {
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const defaultPrefs: UserCompetitionPrefs = {
  id: "",
  user_id: "",
  position_group: "forwards",
  team_order: [],
  player_order: {},
  pinned_players: {},
  last_viewed: "",
  created_at: "",
  updated_at: "",
}

export default function HomePage() {
  const { loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [allPrefs, setAllPrefs] = useState<UserCompetitionPrefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Wizard state
  const [step, setStep] = useState<WizardStep>("position")
  const [activeGroup, setActiveGroup] = useState<PositionGroup>("forwards")
  const [currentPrefs, setCurrentPrefs] = useState<UserCompetitionPrefs>(defaultPrefs)

  useEffect(() => {
    if (authLoading) return

    const load = async () => {
      try {
        const supabase = createClient()

        const [playersRes, prefsRes, crewRes] = await Promise.all([
          supabase
            .from("players_view")
            .select("*")
            .not("position", "is", null)
            .not("previous_team", "is", null),
          supabase
            .from("user_competition_prefs")
            .select("*")
            .order("last_viewed", { ascending: false }),
          supabase
            .from("user_crew")
            .select("*"),
        ])

        if (playersRes.error) throw new Error(playersRes.error.message)
        setPlayers(playersRes.data || [])
        if (crewRes.data) setCrew(crewRes.data)

        const prefs = prefsRes.data || []
        setAllPrefs(prefs)

        // If user has existing sorts, show results view of most recent
        if (prefs.length > 0) {
          const mostRecent = prefs[0]
          setCurrentPrefs(mostRecent)
          setActiveGroup(mostRecent.position_group)
          setStep("done")
        }

        setLoading(false)
      } catch (err) {
        console.error("Home load error:", err)
        setError(err instanceof Error ? err.message : "Failed to load")
        setLoading(false)
      }
    }
    load()
  }, [authLoading])

  const crewNumbers = new Set(crew.map((c) => c.player_number))

  // Filter players by the active position group
  const positionFilter = POSITION_FILTER[activeGroup]
  const filtered = players.filter((p) => p.position === positionFilter)

  const teamOrder = currentPrefs.team_order?.length
    ? currentPrefs.team_order
    : DEFAULT_TEAM_ORDER

  const pinnedPlayers: Record<string, PinnedPlayer> = currentPrefs.pinned_players || {}

  // Group players by previous_team for the rank step
  const playersByTeam: Record<string, Player[]> = {}
  for (const p of filtered) {
    const team = p.previous_team || "Unknown"
    if (!playersByTeam[team]) playersByTeam[team] = []
    playersByTeam[team].push(p)
  }
  for (const team of Object.keys(playersByTeam)) {
    const customOrder = currentPrefs.player_order?.[team]
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

  // Wizard handlers
  const handleSelectPosition = useCallback(
    (group: PositionGroup, reuseTeamOrder: string[] | null) => {
      setActiveGroup(group)
      const existing = allPrefs.find((p) => p.position_group === group)
      if (existing) {
        setCurrentPrefs(existing)
      } else {
        setCurrentPrefs({
          ...defaultPrefs,
          position_group: group,
          team_order: reuseTeamOrder || [],
        })
      }
      setStep("rank")
    },
    [allPrefs]
  )

  const handleTeamReorder = useCallback(
    async (newOrder: string[]) => {
      setCurrentPrefs((prev) => ({ ...prev, team_order: newOrder }))
      try {
        await updateTeamOrder(activeGroup, newOrder)
      } catch (err) {
        console.error("Failed to save team order:", err)
      }
    },
    [activeGroup]
  )

  const handlePlayerReorder = useCallback(
    async (team: string, playerNumbers: number[]) => {
      setCurrentPrefs((prev) => ({
        ...prev,
        player_order: { ...prev.player_order, [team]: playerNumbers },
      }))
      try {
        await updatePlayerOrder(activeGroup, team, playerNumbers)
      } catch (err) {
        console.error("Failed to save player order:", err)
      }
    },
    [activeGroup]
  )

  const handlePinToTeam = useCallback(
    async (playerNumber: number, targetTeam: string, pos: number) => {
      setCurrentPrefs((prev) => ({
        ...prev,
        pinned_players: {
          ...prev.pinned_players,
          [String(playerNumber)]: { team: targetTeam, position: pos },
        },
      }))
      try {
        await pinPlayer(activeGroup, playerNumber, targetTeam, pos)
      } catch (err) {
        console.error("Failed to pin player:", err)
      }
    },
    [activeGroup]
  )

  const handleUnpin = useCallback(
    async (playerNumber: number) => {
      setCurrentPrefs((prev) => {
        const pp = { ...prev.pinned_players }
        delete pp[String(playerNumber)]
        return { ...prev, pinned_players: pp }
      })
      try {
        await unpinPlayer(activeGroup, playerNumber)
      } catch (err) {
        console.error("Failed to unpin player:", err)
      }
    },
    [activeGroup]
  )

  const handleWizardDone = useCallback(async () => {
    const now = new Date().toISOString()
    try {
      await markLastViewed(activeGroup)
    } catch (err) {
      console.error("Failed to mark last viewed:", err)
    }
    const updatedPrefs = { ...currentPrefs, last_viewed: now }
    setCurrentPrefs(updatedPrefs)
    setAllPrefs((prev) => {
      const updated = prev.filter((p) => p.position_group !== activeGroup)
      return [updatedPrefs, ...updated]
    })
    setStep("done")
  }, [activeGroup, currentPrefs])

  const handleRunSorter = useCallback(() => {
    setStep("position")
  }, [])

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

  if (step === "position") {
    return (
      <div className="app-page">
        <StepPosition
          existingPrefs={allPrefs}
          onSelect={handleSelectPosition}
        />
      </div>
    )
  }

  if (step === "rank") {
    return (
      <div className="app-page">
        <StepRankTeams
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={filtered}
          playerOrderMap={currentPrefs.player_order || {}}
          pinnedPlayers={pinnedPlayers}
          crewNumbers={crewNumbers}
          onTeamReorder={handleTeamReorder}
          onPlayerReorder={handlePlayerReorder}
          onPinToTeam={handlePinToTeam}
          onUnpin={handleUnpin}
          onNext={() => setStep("results")}
          onBack={() => setStep("position")}
        />
      </div>
    )
  }

  if (step === "results") {
    return (
      <div className="app-page">
        <StepResults
          positionGroup={activeGroup}
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={currentPrefs.player_order || {}}
          crewNumbers={crewNumbers}
          onPinToTeam={handlePinToTeam}
          onDone={handleWizardDone}
          onBack={() => setStep("rank")}
        />
      </div>
    )
  }

  // step === "done" — results view (return visit)
  return (
    <ResultsView
      positionGroup={activeGroup}
      teamOrder={teamOrder}
      players={players}
      pinnedPlayers={pinnedPlayers}
      playerOrderMap={currentPrefs.player_order || {}}
      crewNumbers={crewNumbers}
      onPinToTeam={handlePinToTeam}
      onRunSorter={handleRunSorter}
    />
  )
}
