import type { Session } from "@/lib/types"

interface CrewHighlight {
  number: number
  name: string
}

export function SessionCard({
  session,
  crewHighlights,
}: {
  session: Session
  crewHighlights?: CrewHighlight[]
}) {
  return (
    <div className="session-card">
      <div className="session-card-header">
        <span className={`level-badge${session.level === "AA" ? " level-badge-aa" : ""}`}>
          {session.level}
        </span>
        <span className="session-card-round">
          Round {session.round_number} · Group {session.group_number}
        </span>
      </div>
      <div className="session-card-time">
        {session.start_time} — {session.end_time}
      </div>
      <div className="session-card-rink">{session.rink}</div>
      {crewHighlights && crewHighlights.length > 0 && (
        <div className="session-card-crew">
          {crewHighlights.map((c) => (
            <span key={c.number} className="session-crew-badge">
              #{c.number} {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
