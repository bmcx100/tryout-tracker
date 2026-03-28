"use client"

import { RotateCcw } from "lucide-react"
import { ResultingTeamsDnd } from "@/components/competition/resulting-teams-dnd"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"

const GROUP_TO_POSITION: Record<PositionGroup, "F" | "D" | "G"> = {
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const GROUP_LABELS: Record<PositionGroup, string> = {
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
}

interface ResultsViewProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  crewNumbers: Set<number>
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onReset: () => void
  onRunSorter: () => void
}

export function ResultsView({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  crewNumbers,
  onPinToTeam,
  onReset,
  onRunSorter,
}: ResultsViewProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="app-page">
      <div className="results-header">
        <h1 className="results-label">
          Here's how it shakes out
        </h1>
        <p className="results-sublabel">Your {GROUP_LABELS[positionGroup]} Sort</p>
      </div>

      <div className="results-toolbar">
        <button className="results-run-btn" onClick={onRunSorter}>
          <RotateCcw size={14} />
          Run the Sorter
        </button>
        <button className="comp-reset-btn" onClick={onReset} title="Reset to defaults">
          <RotateCcw size={14} />
          <span className="comp-reset-label">Reset</span>
        </button>
      </div>

      <div className="results-content">
        <ResultingTeamsDnd
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={playerOrderMap}
          position={position}
          crewNumbers={crewNumbers}
          onPinToTeam={onPinToTeam}
        />
      </div>
    </div>
  )
}
