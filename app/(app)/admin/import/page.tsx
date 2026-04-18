"use client"

import { useState, useEffect } from "react"
import { confirmContinuationsImport } from "@/lib/actions/import"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"
import type { PlayerLevel } from "@/lib/types"

interface ContinuationSession {
  session_number: number
  label: string
  date: string
  start_time: string
  end_time: string
  player_numbers: number[]
  flagged_players: Array<{ number: number; note: string }>
}

interface MissingPlayer {
  number: number
  name: string
  entry_level: string
}

interface ContinuationsScrapeResult {
  level_label: string
  title: string
  sessions: ContinuationSession[]
  all_continuing_numbers: number[]
  playerNames: Record<string, string>
  missingPlayers: MissingPlayer[]
  suggested_round: number
}

const LEVELS: PlayerLevel[] = ["AA", "A", "BB", "B", "C"]

export default function AdminImportPage() {
  const [url, setUrl] = useState("https://www.gowildcats.ca/content/U15-Continuations")
  const [level, setLevel] = useState<PlayerLevel>("AA")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("cont-scrape")
    if (saved) {
      const { url: savedUrl, level: savedLevel } = JSON.parse(saved)
      if (savedUrl) setUrl(savedUrl)
      if (savedLevel) setLevel(savedLevel)
    }
  }, [])
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<ContinuationsScrapeResult | null>(null)
  const [imported, setImported] = useState(false)

  const handleScrape = async () => {
    if (!url) return
    setLoading(true)
    setResult(null)
    setImported(false)

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type: "continuations", level }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Scrape failed")
      }

      const data = await res.json()
      setResult(data)
      localStorage.setItem("cont-scrape", JSON.stringify({ url, level }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scrape failed")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!result) return
    setConfirming(true)
    try {
      await confirmContinuationsImport({
        level,
        round_number: result.suggested_round,
        sessions: result.sessions.map((s) => ({
          session_number: s.session_number,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          player_numbers: s.player_numbers,
        })),
      })
      toast.success(
        `Imported ${result.all_continuing_numbers.length} players across ${result.sessions.length} sessions`
      )
      setImported(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed")
    } finally {
      setConfirming(false)
    }
  }

  const getPlayerName = (num: number) => {
    return result?.playerNames[String(num)] || ""
  }

  const getFlagNote = (session: ContinuationSession, num: number) => {
    return session.flagged_players.find((f) => f.number === num)?.note
  }

  const renderSessions = () => {
    if (!result) return null
    return (
      <div className="cont-sessions">
        {result.sessions.map((session) => (
          <div key={session.session_number} className="cont-session">
            <div className="cont-session-header">
              <span className="cont-session-label">{session.label}</span>
              <span className="cont-session-count">
                {session.player_numbers.length} players
              </span>
            </div>
            <div className="cont-player-list">
              {session.player_numbers.map((num) => {
                const flagNote = getFlagNote(session, num)
                const name = getPlayerName(num)
                return (
                  <div key={num} className="cont-player-row">
                    <span className="cont-player-number">{num}</span>
                    <span className="cont-player-name">
                      {name || <span className="cont-player-unknown">—</span>}
                    </span>
                    {flagNote && (
                      <span className="cont-player-flag">{flagNote}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h1 className="app-page-title">
        Import Continuations from&nbsp;URL
      </h1>

      <div className="admin-form">
        <div className="admin-form-field">
          <Label>Continuations Page URL</Label>
          <div className="import-url-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.gowildcats.ca/content/U15-Continuations"
            />
            <select
              className="cont-level-select"
              value={level}
              onChange={(e) => setLevel(e.target.value as PlayerLevel)}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <button
              className="btn-primary"
              onClick={handleScrape}
              disabled={loading || !url}
            >
              {loading ? "Scraping\u2026" : "Scrape"}
            </button>
          </div>
        </div>
      </div>

      {result && !imported && (
        <div className="cont-preview">
          <h2 className="admin-section-title">
            {result.title} — {result.all_continuing_numbers.length} players
            continuing at&nbsp;{level}
          </h2>

          {result.missingPlayers.length > 0 && (
            <div className="cont-red-flags">
              <h3 className="cont-red-flags-title">
                Missing Players — Cut from higher level
                but&nbsp;not&nbsp;continuing
              </h3>
              {result.missingPlayers.map((p) => (
                <div key={p.number} className="cont-red-flag-row">
                  <span className="cont-red-flag-number">#{p.number}</span>
                  <span className="cont-red-flag-name">
                    {p.name || "Unknown"}
                  </span>
                  <span className="cont-red-flag-note">
                    cut from {p.entry_level}
                  </span>
                </div>
              ))}
            </div>
          )}

          {renderSessions()}

          {result.all_continuing_numbers.length > 0 ? (
            <button
              className="btn-primary"
              onClick={handleConfirm}
              disabled={confirming}
            >
              {confirming ? "Importing\u2026" : "Confirm Import"}
            </button>
          ) : (
            <p className="app-empty-desc">
              No player numbers found. Try a different URL or{" "}
              <Link href="/admin/players" className="crew-link">
                add players manually
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {imported && result && (
        <div className="cont-preview">
          <div className="cont-import-success">
            <p className="import-success">
              Import complete —{" "}
              {result.all_continuing_numbers.length} players across{" "}
              {result.sessions.length} sessions
            </p>
          </div>

          {renderSessions()}

          <div className="cont-post-import-links">
            <Link href="/admin/players" className="btn-secondary">
              View Players
            </Link>
            <Link href="/admin/sessions" className="btn-secondary">
              View Sessions
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
