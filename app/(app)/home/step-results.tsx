"use client"

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

interface StepResultsProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  crewNumbers: Set<number>
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
  onDone,
  onBack,
}: StepResultsProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Here's how it shakes out</h1>
      <p className="wizard-subtext">
        These are the projected {GROUP_LABELS[positionGroup].toLowerCase()} rosters based on your ranking. Drag players between teams to fine-tune.
      </p>

      <div className="comp-content">
        <NewTeamsView
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={playerOrderMap}
          position={position}
          crewNumbers={crewNumbers}
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
