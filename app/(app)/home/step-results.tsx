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

interface StepResultsProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  crewNumbers: Set<number>
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onReset: () => void
  onDone: () => void
  onBack: () => void
}

export function StepResults({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  crewNumbers,
  onPinToTeam,
  onReset,
  onDone,
  onBack,
}: StepResultsProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Move players between teams</h1>
      <p className="wizard-subtext">
        Drag any player up, down, or to a different team to fine-tune your {GROUP_LABELS[positionGroup].toLowerCase()} rosters.
      </p>

      <div className="comp-content">
        <div className="comp-sort-toolbar">
          <button className="comp-reset-btn" onClick={onReset} title="Reset to defaults">
            <RotateCcw size={16} />
            <span className="comp-reset-label">Reset</span>
          </button>
        </div>

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

      <button className="wizard-next-btn" onClick={onDone}>
        Done
      </button>
      <button className="wizard-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
