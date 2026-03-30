"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { TeamTierList } from "@/components/competition/team-tier-list"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

const POSITION_BUTTONS: { group: PositionGroup; label: string }[] = [
  { group: "forwards", label: "Forwards" },
  { group: "defense", label: "Defense" },
  { group: "goalies", label: "Goalies" },
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
  positionOverrides: Record<string, string>
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onReset: () => void
  onResetAll: () => void
  onNext: () => void
  onSwitchPosition: (group: PositionGroup) => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
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
  positionOverrides,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onReset,
  onResetAll,
  onNext,
  onSwitchPosition,
  onPositionOverride,
}: StepRankTeamsProps) {
  const [showInstructions, setShowInstructions] = useState(false)

  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Rank Existing Teams</h1>
      <div className="wizard-instructions-toggle">
        <button
          className="wizard-instructions-btn"
          onClick={() => setShowInstructions((s) => !s)}
        >
          {showInstructions ? "Hide instructions" : "Click here for instructions"}
        </button>
        {showInstructions && (
          <div className="wizard-steps">
            <p>1. Drag Teams up / down to rank top to bottom.</p>
            <p>2. Select Position, expand team, drag Player up / down to change their in team order.</p>
            <p>3. Click &apos;View Resulting Teams&apos; at bottom of the page to see results.</p>
          </div>
        )}
      </div>

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
          onTeamReorder={onTeamReorder}
          onPlayerReorder={onPlayerReorder}
          onPinToTeam={onPinToTeam}
          onPositionOverride={onPositionOverride}
        />
      </div>

      <div className="wizard-bottom-bar">
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
        <button className="btn-primary-icon" onClick={onNext}>
          View Resulting Teams
        </button>
      </div>
    </div>
  )
}
