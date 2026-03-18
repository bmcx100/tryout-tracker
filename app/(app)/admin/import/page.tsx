"use client"

import { useState } from "react"
import { confirmImport } from "@/lib/actions/import"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import Link from "next/link"

interface ParsedPlayer {
  number: number
  name?: string
}

interface ScrapeResult {
  players: ParsedPlayer[]
  raw_text: string
}

export default function AdminImportPage() {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)
  const [imported, setImported] = useState(false)

  const handleScrape = async () => {
    if (!url) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Scrape failed")
      }

      const data = await res.json()
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scrape failed")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!result) return
    try {
      await confirmImport(result.players)
      toast.success(`Imported ${result.players.length} players`)
      setImported(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed")
    }
  }

  return (
    <div>
      <h1 className="app-page-title">Import from URL</h1>

      <div className="admin-form">
        <div className="admin-form-field">
          <Label>URL to Scrape</Label>
          <div className="import-url-row">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://league-website.com/tryouts"
            />
            <button
              className="btn-primary"
              onClick={handleScrape}
              disabled={loading || !url}
            >
              {loading ? "Scraping..." : "Scrape"}
            </button>
          </div>
        </div>
      </div>

      {result && !imported && (
        <div className="import-preview">
          <h2 className="admin-section-title">
            Preview — {result.players.length} players found
          </h2>
          <div className="import-player-list">
            {result.players.map((p) => (
              <span key={p.number} className="import-player-badge">
                #{p.number}
              </span>
            ))}
          </div>
          {result.players.length > 0 ? (
            <button className="btn-primary" onClick={handleConfirm}>
              Confirm Import
            </button>
          ) : (
            <p className="app-empty-desc">
              No player numbers found. Try a different URL or{" "}
              <Link href="/admin/players" className="crew-link">add players manually</Link>.
            </p>
          )}
        </div>
      )}

      {imported && (
        <div className="import-result">
          <p className="import-success">Import complete!</p>
          <Link href="/admin/players" className="btn-secondary">
            View Players
          </Link>
        </div>
      )}
    </div>
  )
}
