"use client"

import { useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { addToCrew, removeFromCrew } from "@/lib/actions/crew"
import { toast } from "sonner"
import { getAgeGroup, playerName, AGE_GROUPS, PREVIOUS_TEAMS, type AgeGroup } from "@/lib/utils"
import type { Player, CrewMember } from "@/lib/types"
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
  const { loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [tab, setTab] = useState<Tab>("crew")
  const [loading, setLoading] = useState(true)

  // All Players filters
  const [search, setSearch] = useState("")
  const [ageFilter, setAgeFilter] = useState("all")
  const [levelFilter, setLevelFilter] = useState("all")

  // Teams filters
  const [teamsView, setTeamsView] = useState<"previous" | "new">("previous")
  const [teamsAge, setTeamsAge] = useState<AgeFilter>("all")

  // Crew sheet
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const fetchData = async () => {
    const supabase = createClient()
    const [{ data: playerData }, { data: crewData }] = await Promise.all([
      supabase.from("players_view").select("*").order("number"),
      supabase.from("user_crew").select("*, player:players(*)").order("tag"),
    ])
    if (playerData) setPlayers(playerData)
    if (crewData) setCrew(crewData)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    fetchData()
  }, [authLoading])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

  // --- Crew tab data ---
  const grouped = TAG_ORDER.map((tag) => ({
    tag,
    members: crew.filter((m) => m.tag === tag),
  }))

  // --- Teams tab data ---
  const agePlayers = teamsAge === "all"
    ? players
    : players.filter((p) => getAgeGroup(p.birth_year) === teamsAge)
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
  const filtered = players.filter((p) => {
    if (ageFilter !== "all") {
      const ag = getAgeGroup(p.birth_year)
      if (ag !== ageFilter) return false
    }
    if (levelFilter !== "all") {
      let level: string | null = p.current_level || p.entry_level
      if (!level && p.previous_team) {
        const match = p.previous_team.match(/^U\d+(.*)/i)
        if (match) level = match[1].toUpperCase()
      }
      if (level !== levelFilter) return false
    }
    if (search) {
      const fullName = playerName(p.first_name, p.last_name).toLowerCase()
      if (!String(p.number).includes(search) && !fullName.includes(search.toLowerCase())) {
        return false
      }
    }
    return true
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
            <div className="players-list">
              {filtered.map((player) => {
                const isInCrew = crewMap.has(player.number)
                return (
                  <div key={player.id} className="player-row">
                    <span className="player-row-number">#{player.number}</span>
                    <span className="player-row-name">{playerName(player.first_name, player.last_name)}</span>
                    <span className="player-row-pos">{player.position || ""}</span>
                    <span className="player-row-team">{player.previous_team || ""}</span>
                    <button
                      className={`crew-heart${isInCrew ? " active" : ""}`}
                      onClick={isInCrew ? undefined : () => handleAddToCrew(player)}
                    >
                      <Heart className="crew-heart-icon" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
