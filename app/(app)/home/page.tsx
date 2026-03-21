"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { FeedItem } from "@/components/feed/feed-item"
import Link from "next/link"
import type { CrewMember, Session } from "@/lib/types"

interface FeedEntry {
  date: string
  playerNumber: number
  personalName: string
  description: string
  tag: string
}

export default function HomePage() {
  const { loading: authLoading } = useAuth()
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [recentUpdates, setRecentUpdates] = useState<FeedEntry[]>([])
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return

    const load = async () => {
      try {
        const supabase = createClient()

        const { data: crewData, error: crewError } = await supabase
          .from("user_crew")
          .select("*, player:players(*)")
          .order("tag")

        if (crewError) {
          console.error("Failed to load crew:", crewError)
          setError(crewError.message)
          setLoading(false)
          return
        }

        if (!crewData || crewData.length === 0) {
          setCrew([])
          setLoading(false)
          return
        }

        setCrew(crewData)

        type CrewRow = { player_number: number; personal_name: string; tag: string }
        const crewMap = new Map(
          crewData.map((c: CrewRow) => [c.player_number, c])
        )
        const crewNumbers = crewData.map((c: CrewRow) => c.player_number)

        // Get recent round results for crew (last 5)
        const { data: results } = await supabase
          .from("round_results")
          .select("*, round:rounds(*)")
          .in("player_number", crewNumbers)
          .order("id", { ascending: false })
          .limit(5)

        if (results) {
          const feed = results.map((r: Record<string, unknown>) => {
            const crewMember = crewMap.get(r.player_number as number)
            const round = r.round as { date: string; level: string; round_number: number } | null
            return {
              date: round?.date || "",
              playerNumber: r.player_number as number,
              personalName: crewMember?.personal_name || `#${r.player_number}`,
              description: `${(r.result as string)?.replace(/_/g, " ") || "unknown"} — ${round?.level || ""} Round ${round?.round_number || ""}`,
              tag: crewMember?.tag || "friend",
            }
          })
          setRecentUpdates(feed)
        }

        // Get upcoming sessions
        const today = new Date().toISOString().split("T")[0]
        const crewLevels = new Set(
          crewData
            .map((c: CrewMember) => c.player?.current_level)
            .filter(Boolean)
        )

        if (crewLevels.size > 0) {
          const { data: sessionData } = await supabase
            .from("sessions")
            .select("*")
            .gte("date", today)
            .in("level", Array.from(crewLevels))
            .order("date")
            .order("start_time")
            .limit(3)

          if (sessionData) setUpcomingSessions(sessionData)
        }

        setLoading(false)
      } catch (err) {
        console.error("Home page load error:", err)
        setError(err instanceof Error ? err.message : "Failed to load")
        setLoading(false)
      }
    }
    load()
  }, [authLoading])

  if (loading) {
    return (
      <div className="app-page">
        <div className="app-page-header">
          <h1 className="app-page-title">Home</h1>
        </div>
        <div className="home-loading">
          <div className="loading-dots">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <p className="home-loading-text">Loading your crew...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-page">
        <div className="app-page-header">
          <h1 className="app-page-title">Home</h1>
        </div>
        <div className="app-empty-state">
          <p className="app-empty-title">Something went wrong</p>
          <p className="app-empty-desc">{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty crew — onboarding
  if (crew.length === 0) {
    return (
      <div className="app-page">
        <div className="app-page-header">
          <h1 className="app-page-title">Home</h1>
        </div>
        <div className="home-welcome">
          <h2 className="home-welcome-title">Welcome to Tryout Tracker</h2>
          <p className="home-welcome-desc">
            Track your kid&apos;s BFFs, teammates, and friends through tryouts.
            Start by finding your kid&apos;s team.
          </p>
          <div className="home-welcome-links">
            <Link href="/teams" className="btn-primary">
              Browse Teams
            </Link>
            <Link href="/players" className="btn-secondary">
              Find Players
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Home</h1>
      </div>

      <div className="home-dashboard">
        <div className="home-quick-links">
          <Link href="/current" className="home-quick-link">
            <span className="home-quick-link-title">Tryouts</span>
            <span className="home-quick-link-desc">Live rounds, results, and scenario builder</span>
          </Link>
          <Link href="/teams" className="home-quick-link">
            <span className="home-quick-link-title">Browse Teams</span>
            <span className="home-quick-link-desc">See last year&apos;s rosters and newly formed teams</span>
          </Link>
          <Link href="/players" className="home-quick-link">
            <span className="home-quick-link-title">Find Players</span>
            <span className="home-quick-link-desc">Search by name, number, age group, or level</span>
          </Link>
          <Link href="/crew" className="home-quick-link">
            <span className="home-quick-link-top">
              <span className="home-quick-link-title">My Crew</span>
              {crew.length > 0 && (
                <span className="home-quick-link-count">{crew.length} friends</span>
              )}
            </span>
            <span className="home-quick-link-desc">
              Favorite your current teammates, BFFs, and former teammates
            </span>
          </Link>
        </div>

        {recentUpdates.length > 0 && (
          <div className="home-recent">
            <h2 className="home-section-title">Recent Updates</h2>
            <div className="feed-list">
              {recentUpdates.map((entry, i) => (
                <FeedItem key={i} item={entry} />
              ))}
            </div>
            <Link href="/current" className="home-see-all">
              See all rounds
            </Link>
          </div>
        )}

        {upcomingSessions.length > 0 && (
          <div className="home-upcoming">
            <h2 className="home-section-title">Upcoming Sessions</h2>
            <div className="home-sessions-list">
              {upcomingSessions.map((s) => (
                <div key={s.id} className="home-session-item">
                  <span className={`level-badge${s.level === "AA" ? " level-badge-aa" : ""}`}>
                    {s.level}
                  </span>
                  <div className="home-session-info">
                    <span className="home-session-time">
                      {s.date} · {s.start_time} — {s.end_time}
                    </span>
                    <span className="home-session-rink">{s.rink}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/current" className="home-see-all">
              See full schedule
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
