"use client"

import { useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { addToCrew } from "@/lib/actions/crew"
import { toast } from "sonner"
import { getAgeGroup, playerName } from "@/lib/utils"
import type { Player, CrewMember } from "@/lib/types"
import { Input } from "@/components/ui/input"

const LEVELS = ["AA", "A", "BB", "B", "C"]

export default function PlayersPage() {
  const { loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [search, setSearch] = useState("")
  const [ageFilter, setAgeFilter] = useState("all")
  const [levelFilter, setLevelFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const supabase = createClient()
    const [{ data: playerData }, { data: crewData }] = await Promise.all([
      supabase.from("players_view").select("*").order("number"),
      supabase.from("user_crew").select("*"),
    ])
    if (playerData) setPlayers(playerData)
    if (crewData) setCrew(crewData)
    setLoading(false)
  }

  useEffect(() => {
    if (authLoading) return
    const load = async () => {
      const supabase = createClient()
      const [{ data: playerData }, { data: crewData }] = await Promise.all([
        supabase.from("players_view").select("*").order("number"),
        supabase.from("user_crew").select("*"),
      ])
      if (playerData) setPlayers(playerData)
      if (crewData) setCrew(crewData)
      setLoading(false)
    }
    load()
  }, [authLoading])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

  const filtered = players.filter((p) => {
    if (ageFilter !== "all") {
      const ag = getAgeGroup(p.birth_year)
      if (ag !== ageFilter) return false
    }
    if (levelFilter !== "all") {
      let level: string | null = p.current_level || p.entry_level || p.previous_level
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

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Players</h1>
      </div>

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
  )
}
