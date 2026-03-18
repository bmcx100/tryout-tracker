import type { Player } from "@/lib/types"

export function PlayerCard({
  player,
  isInCrew,
  crewTag,
  onAddToCrew,
}: {
  player: Player
  isInCrew: boolean
  crewTag?: string
  onAddToCrew: () => void
}) {
  const TAG_LABELS: Record<string, string> = {
    bff: "BFF",
    teammate: "Teammate",
    old_teammate: "Old Teammate",
    friend: "Friend",
  }

  const fullName = [player.first_name, player.last_name].filter(Boolean).join(" ")

  return (
    <div className="explore-card">
      <span className="explore-card-number">#{player.number}</span>
      <div className="explore-card-info">
        {fullName && (
          <span className="explore-card-name">{fullName}</span>
        )}
        <span className="explore-card-meta">
          {[player.position, player.current_level || "—", (player.status || "").replace(/_/g, " ")].filter(Boolean).join(" · ")}
        </span>
        {player.previous_team && (
          <span className="explore-card-prev">{player.previous_team}</span>
        )}
      </div>
      {isInCrew ? (
        <span className={`tag-badge tag-${crewTag?.replace("_", "-") || "friend"}`}>
          {TAG_LABELS[crewTag || "friend"] || crewTag}
        </span>
      ) : (
        <button className="explore-add-btn" onClick={onAddToCrew}>
          + Crew
        </button>
      )}
    </div>
  )
}
