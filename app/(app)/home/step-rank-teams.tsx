"use client"

import { RotateCcw } from "lucide-react"
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
  onReset: () => void
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
  onReset,
  onNext,
  onBack,
}: StepRankTeamsProps) {
  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Rank existing teams</h1>
      <p className="wizard-subtext">
        Drag the teams to rank top to bottom, then click 'Next'.
      </p>

      <div className="comp-content">
        <div className="comp-sort-toolbar">
          <button className="comp-reset-btn" onClick={onReset} title="Reset to defaults">
            <RotateCcw size={16} />
            <span className="comp-reset-label">Reset</span>
          </button>
        </div>

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
