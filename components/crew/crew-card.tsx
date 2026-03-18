import type { CrewMember } from "@/lib/types"

const TAG_LABELS: Record<string, string> = {
  bff: "BFF",
  teammate: "Teammate",
  old_teammate: "Old Teammate",
  friend: "Friend",
}

const TAG_CLASSES: Record<string, string> = {
  bff: "tag-bff",
  teammate: "tag-teammate",
  old_teammate: "tag-old-teammate",
  friend: "tag-friend",
}

export function CrewCard({
  member,
  onClick,
}: {
  member: CrewMember
  onClick?: () => void
}) {
  const statusLabel = member.player
    ? `${member.player.current_level || "—"} — ${(member.player.status || "").replace(/_/g, " ")}`
    : "—"

  const fullName = member.player
    ? [member.player.first_name, member.player.last_name].filter(Boolean).join(" ")
    : null

  return (
    <div className="crew-card" onClick={onClick} role="button" tabIndex={0}>
      <span className="crew-card-number">#{member.player_number}</span>
      <div className="crew-card-info">
        <span className="crew-card-name">{member.personal_name}</span>
        {fullName && (
          <span className="crew-card-real-name">{fullName}</span>
        )}
        <span className={`tag-badge ${TAG_CLASSES[member.tag]}`}>
          {TAG_LABELS[member.tag]}
        </span>
      </div>
      <div className="crew-card-status">
        <span className="crew-card-level">{statusLabel}</span>
        {member.player?.previous_team && (
          <span className="crew-card-prev-team">{member.player.previous_team}</span>
        )}
      </div>
    </div>
  )
}
