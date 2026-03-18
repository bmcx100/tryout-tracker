"use client"

import { TeamCard } from "@/components/teams/team-card"
import { getAgeGroup, type AgeGroup } from "@/lib/utils"
import type { Player, CrewMember } from "@/lib/types"

export function ResultsTab({
  players,
  crewMap,
  ageGroup,
  onCrewChanged,
}: {
  players: Player[]
  crewMap: Map<number, CrewMember>
  ageGroup: AgeGroup
  onCrewChanged: () => void
}) {
  const placed = players.filter(
    (p) => p.status === "placed_on_team" && p.team_placed && getAgeGroup(p.birth_year) === ageGroup
  )

  const teamMap = new Map<string, Player[]>()
  for (const p of placed) {
    const team = p.team_placed!
    const existing = teamMap.get(team) || []
    existing.push(p)
    teamMap.set(team, existing)
  }

  const teams = Array.from(teamMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teamPlayers]) => ({ name, players: teamPlayers }))

  if (teams.length === 0) {
    return (
      <div className="app-empty-state">
        <p className="app-empty-title">No teams formed yet</p>
        <p className="app-empty-desc">Teams will appear here as players are placed.</p>
      </div>
    )
  }

  return (
    <div className="teams-grid">
      {teams.map((group) => (
        <TeamCard
          key={group.name}
          teamName={group.name}
          players={group.players}
          crewMap={crewMap}
          onCrewChanged={onCrewChanged}
        />
      ))}
    </div>
  )
}
