import type { Session } from "@/lib/types"
import type { RosterPlayer } from "@/app/(app)/current/page"
import { playerName } from "@/lib/utils"

const FORWARD_POSITIONS = ["C", "LW", "RW", "F"]
const DEFENSE_POSITIONS = ["D", "LD", "RD"]
const GOALIE_POSITIONS = ["G"]

function getGroup(pos: string | null): "forwards" | "defense" | "goalies" | "unknown" {
  const p = (pos || "").toUpperCase()
  if (FORWARD_POSITIONS.includes(p)) return "forwards"
  if (DEFENSE_POSITIONS.includes(p)) return "defense"
  if (GOALIE_POSITIONS.includes(p)) return "goalies"
  return "unknown"
}

function rosterName(p: RosterPlayer) {
  const name = playerName(p.firstName, p.lastName)
  return name === "—" ? "Unknown" : name
}

function RosterSection({ label, players }: { label: string, players: RosterPlayer[] }) {
  if (players.length === 0) return null
  return (
    <>
      <div className="session-roster-section">{label} ({players.length})</div>
      {players.map((p) => (
        <div
          key={p.number}
          className={`session-roster-row${p.isCrew ? " session-roster-crew" : ""}`}
        >
          <span className="session-roster-number">#{p.number}</span>
          <span className="session-roster-name">{rosterName(p)}</span>
          {p.previousTeam && (
            <span className="session-roster-team">{p.previousTeam}</span>
          )}
        </div>
      ))}
    </>
  )
}

export function SessionCard({
  session,
  roster,
}: {
  session: Session
  roster?: RosterPlayer[]
}) {
  const forwards = roster?.filter((p) => getGroup(p.position) === "forwards") || []
  const defense = roster?.filter((p) => getGroup(p.position) === "defense") || []
  const goalies = roster?.filter((p) => getGroup(p.position) === "goalies") || []
  const unknown = roster?.filter((p) => getGroup(p.position) === "unknown") || []

  const breakdown = [
    forwards.length ? `${forwards.length}F` : "",
    defense.length ? `${defense.length}D` : "",
    goalies.length ? `${goalies.length}G` : "",
    unknown.length ? `${unknown.length}?` : "",
  ].filter(Boolean).join(" · ")

  return (
    <div className="session-card">
      <div className="session-card-header">
        <span className={`level-badge${session.level === "AA" ? " level-badge-aa" : ""}`}>
          {session.level}
        </span>
        <span className="session-card-round">
          Round {session.round_number} · Group {session.group_number}
        </span>
        <span className="session-card-time">
          {session.start_time} — {session.end_time}
        </span>
      </div>
      <div className="session-card-rink">{session.rink}</div>
      {roster && roster.length > 0 && (
        <>
          <div className="session-card-counts">
            <span className="session-card-count">{roster.length} Players</span>
            <span className="session-card-breakdown">{breakdown}</span>
          </div>
          <div className="session-roster">
            <RosterSection label="Forwards" players={forwards} />
            <RosterSection label="Defense" players={defense} />
            <RosterSection label="Goalies" players={goalies} />
            <RosterSection label="Unknown" players={unknown} />
          </div>
        </>
      )}
    </div>
  )
}
