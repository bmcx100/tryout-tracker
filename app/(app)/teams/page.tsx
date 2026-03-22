"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { TeamCard } from "@/components/teams/team-card"
import { getAgeGroup, PREVIOUS_TEAMS, AGE_GROUPS, type AgeGroup } from "@/lib/utils"
import type { Player, CrewMember } from "@/lib/types"

type TeamsView = "previous" | "new"
type AgeFilter = AgeGroup | "all"

export default function TeamsPage() {
  const { loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [view, setView] = useState<TeamsView>("previous")
  const [ageGroup, setAgeGroup] = useState<AgeFilter>("all")
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const supabase = createClient()
    const [{ data: playerData }, { data: crewData }] = await Promise.all([
      supabase.from("players_view").select("*").order("number"),
      supabase.from("user_crew").select("*"),
    ])
    if (playerData) setPlayers(playerData)
    if (crewData) setCrew(crewData)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    const load = async () => {
      const supabase = createClient()
      const [{ data: playerData }, { data: crewData }] = await Promise.all([
        supabase.from("players_view").select("*").order("number"),
        supabase.from("user_crew").select("*"),
      ])
      if (playerData) setPlayers(playerData)
      if (crewData) setCrew(crewData)
      setLoading(false)
    }
    load()
  }, [authLoading])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

  // Previous teams — filtered by age group
  const agePlayers = ageGroup === "all"
    ? players
    : players.filter((p) => getAgeGroup(p.birth_year) === ageGroup)
  const previousTeams = ageGroup === "all"
    ? [...PREVIOUS_TEAMS.U15, ...PREVIOUS_TEAMS.U13]
    : PREVIOUS_TEAMS[ageGroup]
  const previousTeamGroups = previousTeams.map((team) => ({
    name: team,
    players: agePlayers.filter((p) => p.previous_team === team),
  }))

  // New teams — all placed players grouped by team_placed
  const placedPlayers = players.filter((p) => p.status === "placed_on_team" && p.team_placed)
  const newTeamMap = new Map<string, Player[]>()
  for (const p of placedPlayers) {
    const team = p.team_placed!
    const existing = newTeamMap.get(team) || []
    existing.push(p)
    newTeamMap.set(team, existing)
  }
  const newTeamGroups = Array.from(newTeamMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teamPlayers]) => ({ name, players: teamPlayers }))

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Teams</h1>
      </div>

      <div className="teams-view-toggle">
        <button
          className={`teams-view-btn${view === "previous" ? " active" : ""}`}
          onClick={() => setView("previous")}
        >
          Previous Teams
        </button>
        <button
          className={`teams-view-btn${view === "new" ? " active" : ""}`}
          onClick={() => setView("new")}
        >
          New Teams
        </button>
      </div>

      {loading ? null : view === "previous" ? (
        <>
          <div className="feed-filters">
            <button
              className={`feed-filter-btn${ageGroup === "all" ? " active" : ""}`}
              onClick={() => setAgeGroup("all")}
            >
              All
            </button>
            {AGE_GROUPS.map((g) => (
              <button
                key={g}
                className={`feed-filter-btn${ageGroup === g ? " active" : ""}`}
                onClick={() => setAgeGroup(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="teams-grid">
            {previousTeamGroups.map((group) => (
              <TeamCard
                key={group.name}
                teamName={group.name}
                players={group.players}
                crewMap={crewMap}
                onCrewChanged={fetchData}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="teams-grid">
          {newTeamGroups.length === 0 ? (
            <div className="app-empty-state">
              <p className="app-empty-title">No new teams yet</p>
              <p className="app-empty-desc">
                Teams will appear here as players are placed.
              </p>
            </div>
          ) : (
            newTeamGroups.map((group) => (
              <TeamCard
                key={group.name}
                teamName={group.name}
                players={group.players}
                crewMap={crewMap}
                onCrewChanged={fetchData}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
