"use client"

import { RotateCcw, ChevronLeft } from "lucide-react"
import { TeamTierList } from "@/components/competition/team-tier-list"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

const POSITION_BUTTONS: { group: PositionGroup; label: string }[] = [
  { group: "forwards", label: "Forwards" },
  { group: "defense", label: "Defense" },
  { group: "goalies", label: "Goalies" },
]

interface StepRankPlayersProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  positionFilter: "F" | "D" | "G" | "ALL"
  positionGroup: PositionGroup
  positionOverrides: Record<string, string>
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onReset: () => void
  onResetAll: () => void
  onNext: () => void
  onBack: () => void
  onSwitchPosition: (group: PositionGroup) => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
}

export function StepRankPlayers({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  crewNumbers,
  positionFilter,
  positionGroup,
  positionOverrides,
  onPlayerReorder,
  onPinToTeam,
  onReset,
  onResetAll,
  onNext,
  onBack,
  onSwitchPosition,
  onPositionOverride,
}: StepRankPlayersProps) {
  return (
    <div className="wizard-container">
      <div className="wizard-step-row">
        <button className="wizard-back-link" onClick={onBack}>
          <ChevronLeft size={14} />
          Back
        </button>
        <span className="wizard-step-label">Step 2 of 2</span>
      </div>
      <h1 className="wizard-headline">Rank Existing Players</h1>
      <p className="wizard-instruction-inline">
        Expand a team. Drag players up or down to reorder.{" "}
        <span className="nowrap">Drag between teams to move.</span>
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
        <TeamTierList
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={allPlayers}
          playerOrderMap={playerOrderMap}
          pinnedPlayers={pinnedPlayers}
          crewNumbers={crewNumbers}
          positionFilter={positionFilter}
          positionOverrides={positionOverrides}
          onTeamReorder={() => {}}
          onPlayerReorder={onPlayerReorder}
          onPinToTeam={onPinToTeam}
          onPositionOverride={onPositionOverride}
          mode="players"
        />
      </div>

      <div className="wizard-bottom-actions">
        <button className="btn-primary-icon" onClick={onNext}>
          View Resulting Teams
        </button>
        <div className="results-reset-group">
          <button className="comp-reset-btn" onClick={onReset} title="Reset this position">
            <RotateCcw size={16} />
            <span className="comp-reset-label">Reset</span>
          </button>
          <button className="comp-reset-btn" onClick={onResetAll} title="Reset all positions">
            <RotateCcw size={16} />
            <span className="comp-reset-label">Reset All</span>
          </button>
        </div>
      </div>
    </div>
  )
}
