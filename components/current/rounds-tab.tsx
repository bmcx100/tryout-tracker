import { RoundCard } from "@/components/current/round-card"
import { SessionCard } from "@/components/schedule/session-card"
import type { Player, Round, RoundResultRecord, Session, CrewMember } from "@/lib/types"
import type { RosterPlayer } from "@/app/(app)/current/page"
import { playerName } from "@/lib/utils"

interface RoundWithResults extends Round {
  results: RoundResultRecord[]
}

interface SessionWithRoster extends Session {
  roster: RosterPlayer[]
}

export function RoundsTab({
  rounds,
  sessions,
  crewMap,
  missingPlayers,
}: {
  rounds: RoundWithResults[]
  sessions: SessionWithRoster[]
  crewMap: Map<number, CrewMember>
  missingPlayers?: Player[]
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
        <h2 className="current-section-title">{sessions.length} Upcoming Session{sessions.length !== 1 ? "s" : ""}</h2>
        {sessions.length === 0 ? (
          <p className="current-section-empty">No upcoming sessions.</p>
        ) : (
          <div className="schedule-grid">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} roster={s.roster} />
            ))}
          </div>
        )}
      </div>

      {missingPlayers && missingPlayers.length > 0 && (
        <div className="current-section">
          <div className="missing-footnote">
            <div className="missing-footnote-title">Missing from tryout</div>
            {missingPlayers.map((p) => (
              <div key={p.number} className="missing-footnote-row">
                <span className="missing-footnote-number">#{p.number}</span>
                <span className="missing-footnote-name">
                  {playerName(p.first_name, p.last_name, p.number)}
                </span>
                <span className="missing-footnote-detail">
                  cut from {p.entry_level} → expected at {p.current_level}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
