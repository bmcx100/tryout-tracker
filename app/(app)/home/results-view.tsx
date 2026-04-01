"use client"

import { RotateCcw } from "lucide-react"
import { ResultingTeamsDnd } from "@/components/competition/resulting-teams-dnd"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

const GROUP_TO_POSITION: Partial<Record<PositionGroup, "F" | "D" | "G" | "ALL">> = {
  all: "ALL",
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const POSITION_BUTTONS: { group: PositionGroup; label: string }[] = [
  { group: "forwards", label: "Forwards" },
  { group: "defense", label: "Defense" },
  { group: "goalies", label: "Goalies" },
  { group: "all", label: "All" },
]

interface ResultsViewProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  teamSlots: Record<string, Record<string, number>>
  crewNumbers: Set<number>
  positionOverrides: Record<string, string>
  onReorder: (team: string, playerNumbers: number[]) => void
  onUpdateTeamSlots: (teamCode: string, slots: Record<string, number> | null) => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
  onReset: () => void
  onResetAll: () => void
  onRunSorter: () => void
  onSwitchPosition: (group: PositionGroup) => void
}

export function ResultsView({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  teamSlots,
  crewNumbers,
  positionOverrides,
  onReorder,
  onUpdateTeamSlots,
  onPositionOverride,
  onReset,
  onResetAll,
  onRunSorter,
  onSwitchPosition,
}: ResultsViewProps) {
  const position = GROUP_TO_POSITION[positionGroup] || "ALL"

  return (
    <div className="app-page">
      <div className="results-container">
        <div className="results-header">
          <h1 className="results-label">
            Resulting Teams
          </h1>
          <p className="results-sublabel">Expand teams, then drag players between teams to fine tune.</p>
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

        <div className="results-content">
          <ResultingTeamsDnd
            teamOrder={teamOrder}
            players={players}
            pinnedPlayers={pinnedPlayers}
            playerOrderMap={playerOrderMap}
            teamSlots={teamSlots}
            position={position}
            crewNumbers={crewNumbers}
            positionOverrides={positionOverrides}
            onReorder={onReorder}
            onUpdateTeamSlots={onUpdateTeamSlots}
            onPositionOverride={onPositionOverride}
          />
        </div>

        <div className="wizard-bottom-actions">
          <button className="btn-primary-icon" onClick={onRunSorter}>
            <RotateCcw size={14} />
            Re-Rank Existing
          </button>
          <div className="results-reset-group">
            <button className="comp-reset-btn" onClick={onReset} title="Reset this position">
              <RotateCcw size={14} />
              <span className="comp-reset-label">Reset</span>
            </button>
            <button className="comp-reset-btn" onClick={onResetAll} title="Reset all positions">
              <RotateCcw size={14} />
              <span className="comp-reset-label">Reset All</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
