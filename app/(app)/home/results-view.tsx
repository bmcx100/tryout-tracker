"use client"

import { RotateCcw } from "lucide-react"
import { NewTeamsView } from "@/components/competition/new-teams-view"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"
import type { Position } from "@/lib/utils"

const GROUP_TO_POSITION: Record<PositionGroup, Position> = {
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
  onRunSorter: () => void
}

export function ResultsView({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  crewNumbers,
  onRunSorter,
}: ResultsViewProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="app-page">
      <div className="results-header">
        <h1 className="results-label">
          Your {GROUP_LABELS[positionGroup]} Sort
        </h1>
        <button className="results-run-btn" onClick={onRunSorter}>
          <RotateCcw size={14} />
          Run the Sorter
        </button>
      </div>

      <div className="results-content">
        <NewTeamsView
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={playerOrderMap}
          position={position}
          crewNumbers={crewNumbers}
        />
      </div>
    </div>
  )
}
