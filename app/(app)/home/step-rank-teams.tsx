"use client"

import { RotateCcw } from "lucide-react"
import { TeamTierList } from "@/components/competition/team-tier-list"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

const POSITION_BUTTONS: { group: PositionGroup; label: string }[] = [
  { group: "forwards", label: "Forwards" },
  { group: "defense", label: "Defense" },
  { group: "goalies", label: "Goalies" },
  { group: "all", label: "All" },
]

interface StepRankTeamsProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  positionFilter: "F" | "D" | "G" | "ALL"
  positionGroup: PositionGroup
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onReset: () => void
  onNext: () => void
  onSwitchPosition: (group: PositionGroup) => void
}

export function StepRankTeams({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  crewNumbers,
  positionFilter,
  positionGroup,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onReset,
  onNext,
  onSwitchPosition,
}: StepRankTeamsProps) {
  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Rank existing teams</h1>
      <p className="wizard-subtext">
        Drag the teams to rank top to bottom, then click &apos;Next&apos;.
      </p>

      <div className="results-position-tabs">
        {POSITION_BUTTONS.map(({ group, label }) => (
          <button
            key={group}
            className={`results-position-tab${positionGroup === group ? " active" : ""}`}
            onClick={() => onSwitchPosition(group)}
          >
            {label}
          </button>
        ))}
      </div>

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
          positionFilter={positionFilter}
          onTeamReorder={onTeamReorder}
          onPlayerReorder={onPlayerReorder}
          onPinToTeam={onPinToTeam}
        />
      </div>

      <button className="wizard-next-btn" onClick={onNext}>
        Next
      </button>
    </div>
  )
}
