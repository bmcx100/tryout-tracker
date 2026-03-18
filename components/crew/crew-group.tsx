import type { CrewMember } from "@/lib/types"
import { CrewCard } from "./crew-card"

const TAG_TITLES: Record<string, string> = {
  bff: "BFFs",
  teammate: "Teammates",
  old_teammate: "Old Teammates",
  friend: "Friends",
}

export function CrewGroup({
  tag,
  members,
  onMemberClick,
}: {
  tag: string
  members: CrewMember[]
  onMemberClick?: (member: CrewMember) => void
}) {
  if (members.length === 0) return null

  return (
    <div className="crew-group">
      <div className="crew-group-header">
        <span className="crew-group-title">{TAG_TITLES[tag] || tag}</span>
        <span className="crew-group-count">{members.length}</span>
      </div>
      <div className="crew-cards">
        {members.map((member) => (
          <CrewCard
            key={member.id}
            member={member}
            onClick={() => onMemberClick?.(member)}
          />
        ))}
      </div>
    </div>
  )
}
