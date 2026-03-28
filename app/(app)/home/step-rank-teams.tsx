"use client"

import { TeamTierList } from "@/components/competition/team-tier-list"
import type { Player, PinnedPlayer } from "@/lib/types"

interface StepRankTeamsProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onUnpin: (playerNumber: number) => void
  onNext: () => void
  onBack: () => void
}

export function StepRankTeams({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  crewNumbers,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onUnpin,
  onNext,
  onBack,
}: StepRankTeamsProps) {
  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Rank the teams</h1>
      <p className="wizard-subtext">
        Drag teams from strongest to weakest. Players from higher-ranked teams will fill top spots first.
      </p>

      <div className="comp-content">
        <TeamTierList
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={allPlayers}
          playerOrderMap={playerOrderMap}
          pinnedPlayers={pinnedPlayers}
          crewNumbers={crewNumbers}
          onTeamReorder={onTeamReorder}
          onPlayerReorder={onPlayerReorder}
          onPinToTeam={onPinToTeam}
          onUnpin={onUnpin}
        />
      </div>

      <button className="wizard-next-btn" onClick={onNext}>
        Next
      </button>
      <button className="wizard-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
