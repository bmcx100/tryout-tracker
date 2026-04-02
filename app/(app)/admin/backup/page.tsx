"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"

interface BackupTable {
  key: string
  label: string
  table: string
  columns: string
}

const BACKUP_TABLES: BackupTable[] = [
  { key: "players", label: "Players", table: "players", columns: "*" },
  { key: "sessions", label: "Sessions", table: "sessions", columns: "*" },
  { key: "session_players", label: "Session Players", table: "session_players", columns: "*" },
  { key: "rounds", label: "Rounds", table: "rounds", columns: "*" },
  { key: "round_results", label: "Round Results", table: "round_results", columns: "*" },
  { key: "org_members", label: "Users & Roles", table: "org_members", columns: "id, user_id, role, approved_at, created_at, profiles(id, email, display_name)" },
  { key: "corrections", label: "Corrections", table: "corrections", columns: "*" },
  { key: "pre_approved_emails", label: "Pre-Approved Emails", table: "pre_approved_emails", columns: "*" },
  { key: "user_crew", label: "User Crew", table: "user_crew", columns: "*" },
  { key: "user_competition_prefs", label: "Competition Prefs", table: "user_competition_prefs", columns: "*" },
]

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
}

export default function BackupPage() {
  const { activeOrgId, userOrgs } = useAuth()
  const [statuses, setStatuses] = useState<Record<string, "idle" | "loading" | "done" | "error">>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [allStatus, setAllStatus] = useState<"idle" | "loading" | "done" | "error">("idle")

  const orgSlug = userOrgs.find((o) => o.org_id === activeOrgId)?.organizations?.slug ?? "org"

  const updateStatus = (key: string, status: "idle" | "loading" | "done" | "error") => {
    setStatuses((prev) => ({ ...prev, [key]: status }))
  }

  const updateError = (key: string, msg: string) => {
    setErrors((prev) => ({ ...prev, [key]: msg }))
  }

  const backupTable = async (entry: BackupTable) => {
    if (!activeOrgId) return
    updateStatus(entry.key, "loading")
    updateError(entry.key, "")

    const supabase = createClient()
    const { data, error } = await supabase
      .from(entry.table)
      .select(entry.columns)
      .eq("org_id", activeOrgId)

    if (error) {
      updateStatus(entry.key, "error")
      updateError(entry.key, error.message)
      return false
    }

    downloadJson(data, `${orgSlug}_${entry.key}_${timestamp()}.json`)
    updateStatus(entry.key, "done")
    return true
  }

  const backupAll = async () => {
    if (!activeOrgId) return
    setAllStatus("loading")

    const supabase = createClient()
    const allData: Record<string, unknown> = {}
    let hadError = false

    for (const entry of BACKUP_TABLES) {
      updateStatus(entry.key, "loading")
      updateError(entry.key, "")

      const { data, error } = await supabase
        .from(entry.table)
        .select(entry.columns)
        .eq("org_id", activeOrgId)

      if (error) {
        updateStatus(entry.key, "error")
        updateError(entry.key, error.message)
        hadError = true
      } else {
        allData[entry.key] = data
        updateStatus(entry.key, "done")
      }
    }

    downloadJson(allData, `${orgSlug}_full_backup_${timestamp()}.json`)
    setAllStatus(hadError ? "error" : "done")
  }

  return (
    <div>
      <h1 className="app-page-title">Backup</h1>

      <div className="admin-card">
        <h2 className="admin-card-title">Export Data</h2>
        <p className="admin-card-desc">
          Download org data as JSON files to your device.
        </p>

        <div className="backup-list">
          {BACKUP_TABLES.map((entry) => {
            const status = statuses[entry.key] || "idle"
            const error = errors[entry.key]
            return (
              <div key={entry.key} className="backup-row">
                <span className="backup-label">{entry.label}</span>
                <Button
                  onClick={() => backupTable(entry)}
                  disabled={status === "loading"}
                  variant="outline"
                >
                  {status === "loading" ? "Exporting..." : status === "done" ? "Downloaded" : "Export"}
                </Button>
                {error && <span className="backup-error">{error}</span>}
              </div>
            )
          })}
        </div>

        <div className="backup-all">
          <Button
            onClick={backupAll}
            disabled={allStatus === "loading"}
          >
            {allStatus === "loading" ? "Exporting All..." : allStatus === "done" ? "All Downloaded" : "Export All"}
          </Button>
          {allStatus === "error" && (
            <span className="backup-error">Some tables failed — check individual errors above</span>
          )}
        </div>
      </div>
    </div>
  )
}
