"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { SessionCard } from "@/components/schedule/session-card"
import { LevelFilter } from "@/components/schedule/level-filter"
import type { Session, CrewMember } from "@/lib/types"

interface SessionWithCrew extends Session {
  crewHighlights: Array<{ number: number; name: string }>
}

export default function SchedulePage() {
  const [sessions, setSessions] = useState<SessionWithCrew[]>([])
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSchedule = async () => {
      const supabase = createClient()

      const [{ data: sessionData }, { data: crew }, { data: sessionPlayers }] = await Promise.all([
        supabase.from("sessions").select("*").order("date").order("start_time"),
        supabase.from("user_crew").select("player_number, personal_name"),
        supabase.from("session_players").select("*"),
      ])

      const crewMap = new Map(
        (crew || []).map((c: Pick<CrewMember, "player_number" | "personal_name">) => [c.player_number, c.personal_name])
      )

      const spMap = new Map<string, number[]>()
      for (const sp of sessionPlayers || []) {
        const existing = spMap.get(sp.session_id) || []
        existing.push(sp.player_number)
        spMap.set(sp.session_id, existing)
      }

      const enriched = (sessionData || []).map((s: Session) => {
        const playerNumbers = spMap.get(s.id) || []
        const crewHighlights = playerNumbers
          .filter((num) => crewMap.has(num))
          .map((num) => ({ number: num, name: crewMap.get(num)! }))
        return { ...s, crewHighlights }
      })

      setSessions(enriched)
      setLoading(false)
    }

    fetchSchedule()
  }, [])

  const filtered = filter === "all"
    ? sessions
    : sessions.filter((s) => s.level === filter)

  // Separate crew sessions from others
  const crewSessions = filtered.filter((s) => s.crewHighlights.length > 0)
  const otherSessions = filtered.filter((s) => s.crewHighlights.length === 0)

  return (
    <div className="app-page">
      <div className="app-page-header">
        <h1 className="app-page-title">Schedule</h1>
      </div>
      <LevelFilter active={filter} onChange={setFilter} />

      {loading ? (
        <div className="app-empty-state">
          <p className="app-empty-desc">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="app-empty-state">
          <p className="app-empty-title">No sessions posted yet</p>
          <p className="app-empty-desc">
            Check back when ice times are announced.
          </p>
        </div>
      ) : (
        <>
          {crewSessions.length > 0 && (
            <div className="schedule-section">
              <h2 className="schedule-section-title">Your Crew&apos;s Skates</h2>
              <div className="schedule-grid">
                {crewSessions.map((s) => (
                  <SessionCard key={s.id} session={s} crewHighlights={s.crewHighlights} />
                ))}
              </div>
            </div>
          )}
          {otherSessions.length > 0 && (
            <div className="schedule-section">
              <h2 className="schedule-section-title">All Sessions</h2>
              <div className="schedule-grid">
                {otherSessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
