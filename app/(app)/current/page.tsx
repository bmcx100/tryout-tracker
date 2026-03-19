"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { RoundsTab } from "@/components/current/rounds-tab"
import { ResultsTab } from "@/components/current/results-tab"
import { ScenarioBuilder } from "@/components/current/scenario-builder"
import type { Player, Round, RoundResultRecord, Session, CrewMember } from "@/lib/types"

interface SessionWithCrew extends Session {
  crewHighlights: Array<{ number: number; name: string }>
}

interface RoundWithResults extends Round {
  results: RoundResultRecord[]
}

type TryoutsTab = "results" | "rounds" | "scenario"

export default function TryoutsPage() {
  const [activeTab, setActiveTab] = useState<TryoutsTab>("scenario")
  const [rounds, setRounds] = useState<RoundWithResults[]>([])
  const [sessions, setSessions] = useState<SessionWithCrew[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const supabase = createClient()

    const [
      { data: roundData },
      { data: resultData },
      { data: sessionData },
      { data: crewData },
      { data: sessionPlayers },
      { data: playerData },
    ] = await Promise.all([
      supabase.from("rounds").select("*").order("date", { ascending: false }),
      supabase.from("round_results").select("*"),
      supabase.from("sessions").select("*").order("date").order("start_time"),
      supabase.from("user_crew").select("*"),
      supabase.from("session_players").select("*"),
      supabase.from("players_view").select("*"),
    ])

    if (playerData) setPlayers(playerData)
    if (crewData) setCrew(crewData)

    const crewNameMap = new Map(
      (crewData || []).map((c: CrewMember) => [c.player_number, c.personal_name])
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
        const crewHighlights = playerNumbers
          .filter((num) => crewNameMap.has(num))
          .map((num) => ({ number: num, name: crewNameMap.get(num)! }))
        return { ...s, crewHighlights }
      })
    )

    setLoading(false)
  }

  useEffect(() => {
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
        supabase.from("rounds").select("*").order("date", { ascending: false }),
        supabase.from("round_results").select("*"),
        supabase.from("sessions").select("*").order("date").order("start_time"),
        supabase.from("user_crew").select("*"),
        supabase.from("session_players").select("*"),
        supabase.from("players_view").select("*"),
      ])
      if (playerData) setPlayers(playerData)
      if (crewData) setCrew(crewData)
      const crewNameMap = new Map(
        (crewData || []).map((c: CrewMember) => [c.player_number, c.personal_name])
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
          const crewHighlights = playerNumbers
            .filter((num) => crewNameMap.has(num))
            .map((num) => ({ number: num, name: crewNameMap.get(num)! }))
          return { ...s, crewHighlights }
        })
      )
      setLoading(false)
    }
    load()
  }, [])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

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
          className={`tryouts-tab-btn${activeTab === "scenario" ? " active" : ""}`}
          onClick={() => setActiveTab("scenario")}
        >
          Scenario Builder
        </button>
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

          <div className={activeTab !== "scenario" ? "tab-hidden" : ""}>
            <ScenarioBuilder
              players={players}
              crewMap={crewMap}
            />
          </div>
        </>
      )}
    </div>
  )
}
