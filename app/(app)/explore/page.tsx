"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PlayerCard } from "@/components/explore/player-card"
import { AddToCrewDialog } from "@/components/crew/add-to-crew-dialog"
import { LevelFilter } from "@/components/schedule/level-filter"
import type { Player, CrewMember } from "@/lib/types"
import { Input } from "@/components/ui/input"

export default function ExplorePage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedNumber, setSelectedNumber] = useState<number | undefined>()

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
  }, [])

  const crewMap = new Map(crew.map((c) => [c.player_number, c]))

  const filtered = players.filter((p) => {
    const fullName = [p.first_name, p.last_name].filter(Boolean).join(" ").toLowerCase()
    if (search && !String(p.number).includes(search) && !fullName.includes(search.toLowerCase())) {
      return false
    }
    if (filter !== "all" && p.current_level !== filter) return false
    return true
  })

  const handleAddToCrew = (number: number) => {
    setSelectedNumber(number)
    setAddDialogOpen(true)
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Explore</h1>
      </div>

      <div className="explore-search">
        <Input
          placeholder="Search by number or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <LevelFilter active={filter} onChange={setFilter} />

      {loading ? (
        <div className="app-empty-state">
          <p className="app-empty-desc">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-empty-state">
          <p className="app-empty-title">No players found</p>
          <p className="app-empty-desc">
            {players.length === 0
              ? "The admin will add them soon."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="explore-list">
          {filtered.map((player) => {
            const crewMember = crewMap.get(player.number)
            return (
              <PlayerCard
                key={player.id}
                player={player}
                isInCrew={!!crewMember}
                crewTag={crewMember?.tag}
                onAddToCrew={() => handleAddToCrew(player.number)}
              />
            )
          })}
        </div>
      )}

      <AddToCrewDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        playerNumber={selectedNumber}
        onAdded={fetchData}
      />
    </div>
  )
}
