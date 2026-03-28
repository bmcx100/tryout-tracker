"use client"

import { RotateCcw } from "lucide-react"
import { ResultingTeamsDnd } from "@/components/competition/resulting-teams-dnd"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

const GROUP_TO_POSITION: Record<PositionGroup, "F" | "D" | "G" | "ALL"> = {
  all: "ALL",
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const GROUP_LABELS: Record<PositionGroup, string> = {
  all: "All Players",
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
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
  crewNumbers: Set<number>
  onReorder: (team: string, playerNumbers: number[]) => void
  onReset: () => void
  onRunSorter: () => void
  onSwitchPosition: (group: PositionGroup) => void
}

export function ResultsView({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  crewNumbers,
  onReorder,
  onReset,
  onRunSorter,
  onSwitchPosition,
}: ResultsViewProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="app-page">
      <div className="results-header">
        <h1 className="results-label">
          Fine-Tune Rosters
        </h1>
        <p className="results-sublabel">Expand a team, then reorder players by dragging between teams.</p>
      </div>

      <div className="results-toolbar">
        <button className="btn-primary-icon" onClick={onRunSorter}>
          <RotateCcw size={14} />
          Rerun Sort Wizard
        </button>
        <button className="comp-reset-btn" onClick={onReset} title="Reset to defaults">
          <RotateCcw size={14} />
          <span className="comp-reset-label">Reset</span>
        </button>
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
          position={position}
          crewNumbers={crewNumbers}
          onReorder={onReorder}
        />
      </div>
    </div>
  )
}
