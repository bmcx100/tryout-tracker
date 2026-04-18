"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { RoundsTab } from "@/components/current/rounds-tab"
import { ResultsTab } from "@/components/current/results-tab"
import type { Player, Round, RoundResultRecord, Session, CrewMember } from "@/lib/types"

export interface RosterPlayer {
  number: number
  firstName: string | null
  lastName: string | null
  previousTeam: string | null
  position: string | null
  isCrew: boolean
}

interface SessionWithRoster extends Session {
  roster: RosterPlayer[]
}

interface RoundWithResults extends Round {
  results: RoundResultRecord[]
}

type TryoutsTab = "results" | "rounds"

export default function TryoutsPage() {
  const { activeOrgId } = useAuth()
  const [activeTab, setActiveTab] = useState<TryoutsTab>("rounds")
  const [rounds, setRounds] = useState<RoundWithResults[]>([])
  const [sessions, setSessions] = useState<SessionWithRoster[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    if (!activeOrgId) return
    const supabase = createClient()

    const [
      { data: roundData },
      { data: resultData },
      { data: sessionData },
      { data: crewData },
      { data: sessionPlayers },
      { data: playerData },
    ] = await Promise.all([
      supabase.from("rounds").select("*").eq("org_id", activeOrgId).order("date", { ascending: false }),
      supabase.from("round_results").select("*").eq("org_id", activeOrgId),
      supabase.from("sessions").select("*").eq("org_id", activeOrgId).order("date").order("start_time"),
      supabase.from("user_crew").select("*").eq("org_id", activeOrgId),
      supabase.from("session_players").select("*").eq("org_id", activeOrgId),
      supabase.from("players_view").select("*").eq("org_id", activeOrgId),
    ])

    if (playerData) setPlayers(playerData)
    if (crewData) setCrew(crewData)

    const pMap = new Map(
      (playerData || []).map((p: Player) => [p.number, p])
    )
    const cSet = new Set(
      (crewData || []).map((c: CrewMember) => c.player_number)
    )

    const resultsByRound = new Map<string, RoundResultRecord[]>()
    for (const r of resultData || []) {
      const existing = resultsByRound.get(r.round_id) || []
      existing.push(r)
      resultsByRound.set(r.round_id, existing)
    }
    setRounds(
      (roundData || []).map((round: Round) => ({
        ...round,
        results: resultsByRound.get(round.id) || [],
      }))
    )

    const spMap = new Map<string, number[]>()
    for (const sp of sessionPlayers || []) {
      const existing = spMap.get(sp.session_id) || []
      existing.push(sp.player_number)
      spMap.set(sp.session_id, existing)
    }
    setSessions(
      (sessionData || []).map((s: Session) => {
        const playerNumbers = spMap.get(s.id) || []
        const roster: RosterPlayer[] = playerNumbers
          .map((num) => {
            const p = pMap.get(num)
            return {
              number: num,
              firstName: p?.first_name ?? null,
              lastName: p?.last_name ?? null,
              previousTeam: p?.previous_team ?? null,
              position: p?.position ?? null,
              isCrew: cSet.has(num),
            }
          })
          .sort((a, b) => a.number - b.number)
        return { ...s, roster }
      })
    )

    setLoading(false)
  }

  useEffect(() => {
    if (!activeOrgId) return
    const load = async () => {
      const supabase = createClient()
      const [
        { data: roundData },
        { data: resultData },
        { data: sessionData },
        { data: crewData },
        { data: sessionPlayers },
        { data: playerData },
      ] = await Promise.all([
        supabase.from("rounds").select("*").eq("org_id", activeOrgId).order("date", { ascending: false }),
        supabase.from("round_results").select("*").eq("org_id", activeOrgId),
        supabase.from("sessions").select("*").eq("org_id", activeOrgId).order("date").order("start_time"),
        supabase.from("user_crew").select("*").eq("org_id", activeOrgId),
        supabase.from("session_players").select("*").eq("org_id", activeOrgId),
        supabase.from("players_view").select("*").eq("org_id", activeOrgId),
      ])
      if (playerData) setPlayers(playerData)
      if (crewData) setCrew(crewData)

      const playerMap = new Map(
        (playerData || []).map((p: Player) => [p.number, p])
      )
      const crewSet = new Set(
        (crewData || []).map((c: CrewMember) => c.player_number)
      )

      const resultsByRound = new Map<string, RoundResultRecord[]>()
      for (const r of resultData || []) {
        const existing = resultsByRound.get(r.round_id) || []
        existing.push(r)
        resultsByRound.set(r.round_id, existing)
      }
      setRounds(
        (roundData || []).map((round: Round) => ({
          ...round,
          results: resultsByRound.get(round.id) || [],
        }))
      )

      const spMap = new Map<string, number[]>()
      for (const sp of sessionPlayers || []) {
        const existing = spMap.get(sp.session_id) || []
        existing.push(sp.player_number)
        spMap.set(sp.session_id, existing)
      }
      setSessions(
        (sessionData || []).map((s: Session) => {
          const playerNumbers = spMap.get(s.id) || []
          const roster: RosterPlayer[] = playerNumbers
            .map((num) => {
              const p = playerMap.get(num)
              return {
                number: num,
                firstName: p?.first_name ?? null,
                lastName: p?.last_name ?? null,
                previousTeam: p?.previous_team ?? null,
                position: p?.position ?? null,
                isCrew: crewSet.has(num),
              }
            })
            .sort((a, b) => a.number - b.number)
          return { ...s, roster }
        })
      )
      setLoading(false)
    }
    load()
  }, [activeOrgId])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

  // Missing cut-down players: status=cut_to_next_level AND sessions exist for their current_level
  const sessionLevelSet = new Set(sessions.map((s) => s.level))
  const missingPlayers = players.filter(
    (p) => p.status === "cut_to_next_level" && p.current_level && sessionLevelSet.has(p.current_level)
  )

  // Current Rounds: show all rounds and upcoming sessions (no filtering)
  const today = new Date().toISOString().split("T")[0]
  const upcomingSessions = sessions.filter((s) => s.date >= today)

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Tryouts</h1>
      </div>

      <div className="tryouts-tab-toggle">
        <button
          className={`tryouts-tab-btn${activeTab === "rounds" ? " active" : ""}`}
          onClick={() => setActiveTab("rounds")}
        >
          Current Rounds
        </button>
        <button
          className={`tryouts-tab-btn${activeTab === "results" ? " active" : ""}`}
          onClick={() => setActiveTab("results")}
        >
          Results
        </button>
      </div>

      {loading ? null : (
        <>
          <div className={activeTab !== "rounds" ? "tab-hidden" : ""}>
            <RoundsTab
              rounds={rounds}
              sessions={upcomingSessions}
              crewMap={crewMap}
              missingPlayers={missingPlayers}
            />
          </div>

          <div className={activeTab !== "results" ? "tab-hidden" : ""}>
            <ResultsTab
              players={players}
              crewMap={crewMap}
              ageGroup="U15"
              onCrewChanged={fetchData}
            />
          </div>

        </>
      )}
    </div>
  )
}
