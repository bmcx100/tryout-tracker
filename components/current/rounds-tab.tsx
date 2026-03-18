import { RoundCard } from "@/components/current/round-card"
import { SessionCard } from "@/components/schedule/session-card"
import type { Round, RoundResultRecord, Session, CrewMember } from "@/lib/types"

interface RoundWithResults extends Round {
  results: RoundResultRecord[]
}

interface SessionWithCrew extends Session {
  crewHighlights: Array<{ number: number; name: string }>
}

export function RoundsTab({
  rounds,
  sessions,
  crewMap,
}: {
  rounds: RoundWithResults[]
  sessions: SessionWithCrew[]
  crewMap: Map<number, CrewMember>
}) {
  return (
    <>
      <div className="current-section">
        <h2 className="current-section-title">Round Results</h2>
        {rounds.length === 0 ? (
          <p className="current-section-empty">No rounds recorded yet for this level.</p>
        ) : (
          <div className="current-rounds-list">
            {rounds.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                results={round.results}
                crewMap={crewMap}
              />
            ))}
          </div>
        )}
      </div>

      <div className="current-section">
        <h2 className="current-section-title">Upcoming Sessions</h2>
        {sessions.length === 0 ? (
          <p className="current-section-empty">No upcoming sessions.</p>
        ) : (
          <div className="schedule-grid">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} crewHighlights={s.crewHighlights} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
