import { Heart } from "lucide-react"
import type { CrewMember } from "@/lib/types"

export function CrewCard({
  member,
  onClick,
  onRemove,
}: {
  member: CrewMember
  onClick?: () => void
  onRemove?: () => void
}) {
  return (
    <div className="crew-row">
      <button
        className="crew-row-heart"
        onClick={(e) => {
          e.stopPropagation()
          onRemove?.()
        }}
        aria-label="Remove from crew"
      >
        <Heart className="crew-heart-filled" />
      </button>
      <div className="crew-row-info" onClick={onClick} role="button" tabIndex={0}>
        <span className="crew-row-number">#{member.player_number}</span>
        <span className="crew-row-name">{member.personal_name}</span>
        {member.player?.previous_team && (
          <span className="crew-row-team">{member.player.previous_team}</span>
        )}
        {member.player?.position && (
          <span className="crew-row-pos">{member.player.position}</span>
        )}
        {member.notes && (
          <span className="crew-row-notes">{member.notes}</span>
        )}
      </div>
    </div>
  )
}
