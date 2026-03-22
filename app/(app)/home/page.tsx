"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { TeamTierList } from "@/components/competition/team-tier-list"
import { NewTeamsView } from "@/components/competition/new-teams-view"
import { RotateCcw, Info } from "lucide-react"
import type { Player, UserCompetitionPrefs, PinnedPlayer, CrewMember } from "@/lib/types"
import {
  DEFAULT_TEAM_ORDER,
  POSITIONS,
  type Position,
} from "@/lib/utils"
import {
  updateTeamOrder,
  updatePlayerOrder,
  pinPlayer,
  unpinPlayer,
  resetAllPrefs,
} from "@/lib/actions/competition-prefs"

const defaultPrefs = {
  id: "",
  user_id: "",
  team_order: [] as string[],
  player_order: {} as Record<string, number[]>,
  pinned_players: {} as Record<string, { team: string; position: number }>,
  created_at: "",
  updated_at: "",
}

export default function HomePage() {
  const { loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [prefs, setPrefs] = useState<UserCompetitionPrefs | null>(null)
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("comp-position") as Position) || "ALL"
    }
    return "ALL"
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [view, setView] = useState<"sort" | "teams">("sort")

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
            .single(),
          supabase
            .from("user_crew")
            .select("*"),
        ])

        if (playersRes.error) throw new Error(playersRes.error.message)
        setPlayers(playersRes.data || [])
        if (crewRes.data) setCrew(crewRes.data)

        if (prefsRes.data) {
          setPrefs(prefsRes.data)
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

  useEffect(() => {
    localStorage.setItem("comp-position", position)
  }, [position])

  const teamOrder = prefs?.team_order?.length
    ? prefs.team_order
    : DEFAULT_TEAM_ORDER

  const pinnedPlayers: Record<string, PinnedPlayer> = prefs?.pinned_players || {}
  const crewNumbers = new Set(crew.map((c) => c.player_number))

  // Filter players by selected position
  const filtered = position === "ALL"
    ? players
    : players.filter((p) => p.position === position)

  // Group by previous_team
  const playersByTeam: Record<string, Player[]> = {}
  for (const p of filtered) {
    const team = p.previous_team || "Unknown"
    if (!playersByTeam[team]) playersByTeam[team] = []
    playersByTeam[team].push(p)
  }

  // Sort players within each team by user pref or by number
  for (const team of Object.keys(playersByTeam)) {
    const customOrder = prefs?.player_order?.[team]
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

  const handleTeamReorder = useCallback(
    async (newOrder: string[]) => {
      setPrefs((prev) => {
        if (!prev) return { ...defaultPrefs, team_order: newOrder }
        return { ...prev, team_order: newOrder }
      })
      try {
        await updateTeamOrder(newOrder)
      } catch (err) {
        console.error("Failed to save team order:", err)
      }
    },
    []
  )

  const handlePlayerReorder = useCallback(
    async (team: string, playerNumbers: number[]) => {
      setPrefs((prev) => {
        const base = prev || defaultPrefs
        return {
          ...base,
          player_order: { ...base.player_order, [team]: playerNumbers },
        }
      })
      try {
        await updatePlayerOrder(team, playerNumbers)
      } catch (err) {
        console.error("Failed to save player order:", err)
      }
    },
    []
  )

  const handlePinToTeam = useCallback(
    async (playerNumber: number, targetTeam: string, pos: number) => {
      setPrefs((prev) => {
        const base = prev || defaultPrefs
        return {
          ...base,
          pinned_players: {
            ...base.pinned_players,
            [String(playerNumber)]: { team: targetTeam, position: pos },
          },
        }
      })
      try {
        await pinPlayer(playerNumber, targetTeam, pos)
      } catch (err) {
        console.error("Failed to pin player:", err)
      }
    },
    []
  )

  const handleUnpin = useCallback(
    async (playerNumber: number) => {
      setPrefs((prev) => {
        if (!prev) return prev
        const pp = { ...prev.pinned_players }
        delete pp[String(playerNumber)]
        return { ...prev, pinned_players: pp }
      })
      try {
        await unpinPlayer(playerNumber)
      } catch (err) {
        console.error("Failed to unpin player:", err)
      }
    },
    []
  )

  const handleReset = useCallback(async () => {
    if (!confirm("Reset to default order? This clears all your customizations.")) return
    setResetting(true)
    setPrefs(null)
    try {
      await resetAllPrefs()
    } catch (err) {
      console.error("Failed to reset:", err)
    }
    setResetting(false)
  }, [])

  const totalCount = filtered.length

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

  return (
    <div className="app-page">
      <div className="comp-instructions">
        <Info size={16} />
        <p>Pick your position, sort teams and players, then click Resulting Teams.</p>
      </div>

      <div className="comp-position-tabs">
        {POSITIONS.map((pos) => (
          <button
            key={pos.value}
            className={`comp-position-tab${position === pos.value ? " comp-position-tab-active" : ""}`}
            onClick={() => setPosition(pos.value)}
          >
            {pos.label}
          </button>
        ))}
      </div>

      <div className="comp-view-tabs">
        <button
          className={`comp-view-tab${view === "sort" ? " comp-view-tab-active" : ""}`}
          onClick={() => setView("sort")}
        >
          Sort Order
        </button>
        <button
          className={`comp-view-tab${view === "teams" ? " comp-view-tab-active" : ""}`}
          onClick={() => setView("teams")}
        >
          Resulting Teams
        </button>
      </div>

      {view === "sort" ? (
      <div className="comp-content">
        <div className="comp-sort-toolbar">
          <button
            className="comp-reset-btn"
            onClick={handleReset}
            disabled={resetting}
            title="Reset to defaults"
          >
            <RotateCcw size={16} />
            <span className="comp-reset-label">Reset</span>
          </button>
        </div>

        {totalCount === 0 ? (
          <div className="app-empty-state">
            <p className="app-empty-title">No players</p>
            <p className="app-empty-desc">
              No {POSITIONS.find((p) => p.value === position)?.label?.toLowerCase()} players with a previous team on record.
            </p>
          </div>
        ) : (
          <TeamTierList
            teamOrder={teamOrder}
            playersByTeam={playersByTeam}
            allPlayers={filtered}
            playerOrderMap={prefs?.player_order || {}}
            pinnedPlayers={pinnedPlayers}
            crewNumbers={crewNumbers}
            onTeamReorder={handleTeamReorder}
            onPlayerReorder={handlePlayerReorder}
            onPinToTeam={handlePinToTeam}
            onUnpin={handleUnpin}
          />
        )}
      </div>
      ) : (
      <div className="comp-content">
        <NewTeamsView
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={prefs?.player_order || {}}
          position={position}
          crewNumbers={crewNumbers}
        />
      </div>
      )}
    </div>
  )
}
