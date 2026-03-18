"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { FeedItem } from "@/components/feed/feed-item"
import { FeedFilters } from "@/components/feed/feed-filters"

interface FeedEntry {
  date: string
  playerNumber: number
  personalName: string
  description: string
  tag: string
}

export default function FeedPage() {
  const [entries, setEntries] = useState<FeedEntry[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFeed = async () => {
      const supabase = createClient()

      // Get user's crew
      const { data: crew } = await supabase
        .from("user_crew")
        .select("player_number, personal_name, tag")

      if (!crew || crew.length === 0) {
        setLoading(false)
        return
      }

      type CrewRow = { player_number: number; personal_name: string; tag: string }
      const crewMap = new Map(
        crew.map((c: CrewRow) => [c.player_number, c])
      )
      const crewNumbers = crew.map((c: CrewRow) => c.player_number)

      // Get round results for crew members
      const { data: results } = await supabase
        .from("round_results")
        .select("*, round:rounds(*)")
        .in("player_number", crewNumbers)
        .order("id", { ascending: false })

      if (results) {
        const feed = results.map((r: Record<string, unknown>) => {
          const crewMember = crewMap.get(r.player_number as number)
          const round = r.round as { date: string; level: string; round_number: number } | null
          return {
            date: round?.date || "—",
            playerNumber: r.player_number as number,
            personalName: crewMember?.personal_name || `#${r.player_number}`,
            description: `${(r.result as string).replace(/_/g, " ")} — ${round?.level || ""} Round ${round?.round_number || ""}`,
            tag: crewMember?.tag || "friend",
          }
        })
        setEntries(feed)
      }

      setLoading(false)
    }

    fetchFeed()
  }, [])

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => e.tag === filter)

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Feed</h1>
      </div>
      <FeedFilters active={filter} onChange={setFilter} />

      {loading ? (
        <div className="app-empty-state">
          <p className="app-empty-desc">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-empty-state">
          <p className="app-empty-title">No updates yet</p>
          <p className="app-empty-desc">
            Add friends to your crew to see their progress here.
          </p>
        </div>
      ) : (
        <div className="feed-list">
          {filtered.map((entry, i) => (
            <FeedItem key={i} item={entry} />
          ))}
        </div>
      )}
    </div>
  )
}
