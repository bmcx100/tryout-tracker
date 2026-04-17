"use client"

import { useEffect, useState, Fragment } from "react"
import { Heart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { addToCrew, removeFromCrew } from "@/lib/actions/crew"
import { toast } from "sonner"
import { getAgeGroup, playerName, extractLevelFromTeam, AGE_GROUPS, PREVIOUS_TEAMS, type AgeGroup } from "@/lib/utils"
import type { Player, CrewMember, Session, Round, RoundResult as RoundResultType, PlayerLevel } from "@/lib/types"
import {
  buildProgressionMap,
  getOverallStatus,
  getLevelsWithSessions,
  type ProgressionMap,
} from "@/lib/progression"
import { Input } from "@/components/ui/input"
import { CrewGroup } from "@/components/crew/crew-group"
import { CrewDetailSheet } from "@/components/crew/crew-detail-sheet"
import { AddToCrewDialog } from "@/components/crew/add-to-crew-dialog"
import { TeamCard } from "@/components/teams/team-card"

type Tab = "crew" | "teams" | "all"
type AgeFilter = AgeGroup | "all"

const TAG_ORDER = ["bff", "teammate", "old_teammate", "friend"]
const LEVELS = ["AA", "A", "BB", "B", "C"]

export default function PlayersPage() {
  const { activeOrgId } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [tab, setTab] = useState<Tab>("crew")
  const [loading, setLoading] = useState(true)

  // All Players filters
  const [search, setSearch] = useState("")
  const [ageFilter, setAgeFilter] = useState("all")
  const [levelFilter, setLevelFilter] = useState("all")
  const [posFilter, setPosFilter] = useState("all")
  const [sortCol, setSortCol] = useState<string>("number")
  const [sortAsc, setSortAsc] = useState(true)

  // Teams filters
  const [teamsView, setTeamsView] = useState<"previous" | "new">("previous")
  const [teamsAge, setTeamsAge] = useState<AgeFilter>("all")

  // Crew sheet
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionPlayers, setSessionPlayers] = useState<{ session_id: string; player_number: number }[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [roundResults, setRoundResults] = useState<{ round_id: string; player_number: number; result: RoundResultType }[]>([])
  const [showLevelDetails, setShowLevelDetails] = useState(false)

  const fetchData = async () => {
    if (!activeOrgId) return
    const supabase = createClient()
    const [
      { data: playerData },
      { data: crewData },
      { data: sessionData },
      { data: spData },
      { data: roundData },
      { data: rrData },
    ] = await Promise.all([
      supabase.from("players_view").select("*").eq("org_id", activeOrgId).order("number"),
      supabase.from("user_crew").select("*, player:players(*)").eq("org_id", activeOrgId).order("tag"),
      supabase.from("sessions").select("id, level, round_number, group_number, date").eq("org_id", activeOrgId),
      supabase.from("session_players").select("session_id, player_number").eq("org_id", activeOrgId),
      supabase.from("rounds").select("id, level, round_number").eq("org_id", activeOrgId),
      supabase.from("round_results").select("round_id, player_number, result").eq("org_id", activeOrgId),
    ])
    if (playerData) setPlayers(playerData)
    if (crewData) setCrew(crewData)
    if (sessionData) setSessions(sessionData as Session[])
    if (spData) setSessionPlayers(spData)
    if (roundData) setRounds(roundData as Round[])
    if (rrData) setRoundResults(rrData as { round_id: string; player_number: number; result: RoundResultType }[])
    setLoading(false)
  }

  useEffect(() => {
    if (!activeOrgId) return
    fetchData()
  }, [activeOrgId])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

  // --- Crew tab data ---
  const grouped = TAG_ORDER.map((tag) => ({
    tag,
    members: crew.filter((m) => m.tag === tag),
  }))

  // --- Teams tab data ---
  const activePlayers = players.filter((p) => p.status !== "withdrawn")
  const agePlayers = teamsAge === "all"
    ? activePlayers
    : activePlayers.filter((p) => getAgeGroup(p.birth_year) === teamsAge)
  const previousTeams = teamsAge === "all"
    ? [...PREVIOUS_TEAMS.U15, ...PREVIOUS_TEAMS.U13]
    : PREVIOUS_TEAMS[teamsAge]
  const previousTeamGroups = previousTeams.map((team) => ({
    name: team,
    players: agePlayers.filter((p) => p.previous_team === team),
  }))
  const placedPlayers = players.filter((p) => p.status === "placed_on_team" && p.team_placed)
  const newTeamMap = new Map<string, Player[]>()
  for (const p of placedPlayers) {
    const team = p.team_placed!
    const existing = newTeamMap.get(team) || []
    existing.push(p)
    newTeamMap.set(team, existing)
  }
  const newTeamGroups = Array.from(newTeamMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, teamPlayers]) => ({ name, players: teamPlayers }))

  // --- All Players tab data ---
  const progressionMap: ProgressionMap = buildProgressionMap(
    players, sessions, sessionPlayers, rounds, roundResults
  )
  const levelsWithSessions = getLevelsWithSessions(sessions)

  const FORWARD_POSITIONS = ["C", "LW", "RW", "F"]
  const DEFENSE_POSITIONS = ["D", "LD", "RD"]
  const GOALIE_POSITIONS = ["G"]

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc)
    } else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  const filtered = players.filter((p) => {
    if (ageFilter !== "all") {
      const ag = getAgeGroup(p.birth_year)
      if (ag !== ageFilter) return false
    }
    if (levelFilter !== "all") {
      const level = extractLevelFromTeam(p.previous_team)
      if (level !== levelFilter) return false
    }
    if (posFilter !== "all") {
      const pos = (p.position || "").toUpperCase()
      if (posFilter === "forwards" && !FORWARD_POSITIONS.includes(pos)) return false
      if (posFilter === "defense" && !DEFENSE_POSITIONS.includes(pos)) return false
      if (posFilter === "goalies" && !GOALIE_POSITIONS.includes(pos)) return false
    }
    if (search) {
      const fullName = playerName(p.first_name, p.last_name).toLowerCase()
      if (!String(p.number).includes(search) && !fullName.includes(search.toLowerCase())) {
        return false
      }
    }
    return true
  }).sort((a, b) => {
    const dir = sortAsc ? 1 : -1
    if (sortCol === "number") return (a.number - b.number) * dir
    if (sortCol === "name") {
      const an = playerName(a.first_name, a.last_name)
      const bn = playerName(b.first_name, b.last_name)
      return an.localeCompare(bn) * dir
    }
    if (sortCol === "position") return (a.position || "").localeCompare(b.position || "") * dir
    if (sortCol === "previous_team") return (a.previous_team || "").localeCompare(b.previous_team || "") * dir
    if (sortCol === "status") {
      const as_ = getOverallStatus(a, progressionMap, levelsWithSessions).label
      const bs_ = getOverallStatus(b, progressionMap, levelsWithSessions).label
      return as_.localeCompare(bs_) * dir
    }
    if (sortCol === "team") return (a.team_placed || "").localeCompare(b.team_placed || "") * dir
    return 0
  })

  const handleAddToCrew = async (player: Player) => {
    const name = playerName(player.first_name, player.last_name, player.number)
    try {
      await addToCrew({
        player_number: player.number,
        personal_name: name,
        tag: "friend",
      })
      toast.success(`Added ${name} to your crew`)
      fetchData()
    } catch {
      toast.error("Failed to add to crew")
    }
  }

  const handleRemoveMember = async (member: CrewMember) => {
    await removeFromCrew(member.id)
    await fetchData()
  }

  return (
    <div className="app-page">
      <div className="players-tabs">
        <button
          className={`players-tab${tab === "crew" ? " players-tab-active" : ""}`}
          onClick={() => setTab("crew")}
        >
          My Crew
        </button>
        <button
          className={`players-tab${tab === "teams" ? " players-tab-active" : ""}`}
          onClick={() => setTab("teams")}
        >
          Teams
        </button>
        <button
          className={`players-tab${tab === "all" ? " players-tab-active" : ""}`}
          onClick={() => setTab("all")}
        >
          All Players
        </button>
      </div>

      {tab === "crew" && (
        <div className="players-tab-content">
          {!loading && (
            <div className="players-tab-toolbar">
              <button className="btn-primary" onClick={() => setAddOpen(true)}>
                Add to Crew
              </button>
            </div>
          )}

          {!loading && crew.length === 0 ? (
            <div className="app-empty-state">
              <p className="app-empty-title">Your crew is empty</p>
              <p className="app-empty-desc">
                Switch to All Players to add your kid&apos;s friends and teammates.
              </p>
            </div>
          ) : (
            grouped.map(({ tag, members }) => (
              <CrewGroup
                key={tag}
                tag={tag}
                members={members}
                onMemberClick={(member) => {
                  setSelectedMember(member)
                  setSheetOpen(true)
                }}
                onRemoveMember={handleRemoveMember}
              />
            ))
          )}

          <CrewDetailSheet
            member={selectedMember}
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            onUpdated={fetchData}
          />

          <AddToCrewDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onAdded={fetchData}
          />
        </div>
      )}

      {tab === "teams" && (
        <div className="players-tab-content">
          <div className="teams-view-toggle">
            <button
              className={`teams-view-btn${teamsView === "previous" ? " active" : ""}`}
              onClick={() => setTeamsView("previous")}
            >
              Previous Teams
            </button>
            <button
              className={`teams-view-btn${teamsView === "new" ? " active" : ""}`}
              onClick={() => setTeamsView("new")}
            >
              New Teams
            </button>
          </div>

          {loading ? null : teamsView === "previous" ? (
            <>
              <div className="feed-filters">
                <button
                  className={`feed-filter-btn${teamsAge === "all" ? " active" : ""}`}
                  onClick={() => setTeamsAge("all")}
                >
                  All
                </button>
                {AGE_GROUPS.map((g) => (
                  <button
                    key={g}
                    className={`feed-filter-btn${teamsAge === g ? " active" : ""}`}
                    onClick={() => setTeamsAge(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="teams-grid">
                {previousTeamGroups.map((group) => (
                  <TeamCard
                    key={group.name}
                    teamName={group.name}
                    players={group.players}
                    crewMap={crewMap}
                    onCrewChanged={fetchData}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="teams-grid">
              {newTeamGroups.length === 0 ? (
                <div className="app-empty-state">
                  <p className="app-empty-title">No new teams yet</p>
                  <p className="app-empty-desc">
                    Teams will appear here as players are placed.
                  </p>
                </div>
              ) : (
                newTeamGroups.map((group) => (
                  <TeamCard
                    key={group.name}
                    teamName={group.name}
                    players={group.players}
                    crewMap={crewMap}
                    onCrewChanged={fetchData}
                  />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tab === "all" && (
        <div className="players-tab-content">
          <div className="feed-filters">
            <button
              className={`feed-filter-btn${ageFilter === "all" ? " active" : ""}`}
              onClick={() => setAgeFilter("all")}
            >
              All
            </button>
            <button
              className={`feed-filter-btn${ageFilter === "U13" ? " active" : ""}`}
              onClick={() => setAgeFilter("U13")}
            >
              U13
            </button>
            <button
              className={`feed-filter-btn${ageFilter === "U15" ? " active" : ""}`}
              onClick={() => setAgeFilter("U15")}
            >
              U15
            </button>
          </div>

          <div className="feed-filters">
            <button
              className={`feed-filter-btn${levelFilter === "all" ? " active" : ""}`}
              onClick={() => setLevelFilter("all")}
            >
              All
            </button>
            {LEVELS.map((l) => (
              <button
                key={l}
                className={`feed-filter-btn${levelFilter === l ? " active" : ""}`}
                onClick={() => setLevelFilter(l)}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="feed-filters">
            {(["all", "forwards", "defense", "goalies"] as const).map((p) => (
              <button
                key={p}
                className={`feed-filter-btn${posFilter === p ? " active" : ""}`}
                onClick={() => setPosFilter(p)}
              >
                {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <div className="explore-search">
            <Input
              placeholder="Search by number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? null : filtered.length === 0 ? (
            <div className="app-empty-state">
              <p className="app-empty-title">No players found</p>
              <p className="app-empty-desc">
                {players.length === 0
                  ? "The admin will add them soon."
                  : "Try a different search or filter."}
              </p>
            </div>
          ) : (
            <div className="prog-table-wrap">
              <table className="prog-table">
                <thead>
                  <tr>
                    <th className="prog-sort-header" onClick={() => handleSort("number")}>
                      # {sortCol === "number" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th className="prog-sort-header" style={{ textAlign: "left" }} onClick={() => handleSort("name")}>
                      Name {sortCol === "name" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th className="prog-sort-header" onClick={() => handleSort("position")}>
                      Pos {sortCol === "position" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th className="prog-sort-header" onClick={() => handleSort("previous_team")}>
                      Prev Team {sortCol === "previous_team" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th className="prog-sort-header" onClick={() => handleSort("status")}>
                      Status {sortCol === "status" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    <th className="prog-sort-header" onClick={() => handleSort("team")}>
                      Team {sortCol === "team" ? (sortAsc ? "▲" : "▼") : ""}
                    </th>
                    {showLevelDetails && LEVELS.map((l) => (
                      <th key={l} className="prog-level-header" colSpan={2}>{l}</th>
                    ))}
                    <th className="prog-sub-header">
                      <button
                        className="prog-toggle"
                        onClick={() => setShowLevelDetails(!showLevelDetails)}
                      >
                        {showLevelDetails ? "Hide" : "Details"}
                      </button>
                    </th>
                  </tr>
                  {showLevelDetails && (
                    <tr>
                      <th colSpan={6} />
                      {LEVELS.map((l) => (
                        <Fragment key={l}>
                          <th className="prog-sub-header">Sessions</th>
                          <th className="prog-sub-header">Result</th>
                        </Fragment>
                      ))}
                      <th />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filtered.map((player) => {
                    const isInCrew = crewMap.has(player.number)
                    const status = getOverallStatus(player, progressionMap, levelsWithSessions)
                    const playerProg = progressionMap.get(player.number)
                    return (
                      <tr key={player.id} className={status.rowClass || ""}>
                        <td className="prog-cell">{player.number}</td>
                        <td className="prog-cell" style={{ textAlign: "left" }}>
                          {playerName(player.first_name, player.last_name)}
                        </td>
                        <td className="prog-cell prog-sessions">{player.position || "—"}</td>
                        <td className="prog-cell prog-sessions">{player.previous_team || "—"}</td>
                        <td className={`prog-cell prog-status${status.color ? ` ${status.color}` : ""}`}>
                          {status.label}
                        </td>
                        <td className="prog-cell prog-team">{player.team_placed || "—"}</td>
                        {showLevelDetails && LEVELS.map((l) => {
                          const entry = playerProg?.get(l as PlayerLevel)
                          return (
                            <Fragment key={l}>
                              <td className="prog-cell prog-sessions">
                                {entry?.sessions.length ? entry.sessions.join(", ") : <span className="prog-dash">—</span>}
                              </td>
                              <td className={`prog-cell${entry?.resultColor ? ` ${entry.resultColor}` : ""}`}>
                                {entry?.result || <span className="prog-dash">—</span>}
                              </td>
                            </Fragment>
                          )
                        })}
                        <td className="prog-cell">
                          <button
                            className={`crew-heart${isInCrew ? " active" : ""}`}
                            onClick={isInCrew ? undefined : () => handleAddToCrew(player)}
                          >
                            <Heart className="crew-heart-icon" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
