import { Heart } from "lucide-react"
import { playerName } from "@/lib/utils"
import type { Player } from "@/lib/types"

export function RosterRow({
  player,
  isInCrew,
  onAddToCrew,
  onRemoveFromCrew,
}: {
  player: Player
  isInCrew: boolean
  crewTag?: string
  onAddToCrew: () => void
  onRemoveFromCrew?: () => void
}) {
  return (
    <div className="roster-row">
      <span className="roster-row-number">#{player.number}</span>
      <span className="roster-row-name">{playerName(player.first_name, player.last_name)}</span>
      {player.notes && (
        <span className="roster-row-notes">{player.notes}</span>
      )}
      <button
        className={`crew-heart crew-heart-team${isInCrew ? " active" : ""}`}
        onClick={isInCrew ? onRemoveFromCrew : onAddToCrew}
      >
        <Heart className="crew-heart-icon" />
      </button>
    </div>
  )
}
