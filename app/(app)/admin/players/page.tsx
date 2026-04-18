"use client"

import { useEffect, useState, Fragment } from "react"
import { createClient } from "@/lib/supabase/client"
import { createPlayer, updatePlayer, deletePlayer, bulkCreatePlayers, changePlayerNumber } from "@/lib/actions/players"
import { useAuth } from "@/hooks/use-auth"
import { getAgeGroup, playerName, extractLevelFromTeam } from "@/lib/utils"
import type { Player, PlayerLevel, PlayerStatus } from "@/lib/types"
import type { Session, Round, RoundResult as RoundResultType } from "@/lib/types"
import {
  buildProgressionMap,
  getOverallStatus,
  getLevelsWithSessions,
  type ProgressionMap,
} from "@/lib/progression"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const LEVELS: PlayerLevel[] = ["AA", "A", "BB", "B", "C"]
const PREVIOUS_TEAM_OPTIONS = [
  "U15AA", "U15A", "U15BB", "U15B", "U15C",
  "U13AA", "U13A", "U13BB", "U13B", "U13C",
]
const STATUSES: PlayerStatus[] = ["active_tryout", "cut_to_next_level", "placed_on_team", "withdrawn"]

type BulkRow = {
  number: number
  first_name?: string
  last_name?: string
  previous_team?: string
  position?: string
  birth_year?: number
  notes?: string
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Player | null>(null)
  const [ageFilter, setAgeFilter] = useState<string>("all")
  const [filterLevel, setFilterLevel] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const [bulkPreview, setBulkPreview] = useState<BulkRow[]>([])
  const [bulkError, setBulkError] = useState("")
  const [bulkLoading, setBulkLoading] = useState(false)
  const { activeOrgId } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionPlayers, setSessionPlayers] = useState<{ session_id: string; player_number: number }[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [roundResults, setRoundResults] = useState<{ round_id: string; player_number: number; result: RoundResultType }[]>([])
  const [showLevelDetails, setShowLevelDetails] = useState(false)

  const supabase = createClient()

  const fetchPlayers = async () => {
    if (!activeOrgId) return
    const [
      { data: playerData },
      { data: sessionData },
      { data: spData },
      { data: roundData },
      { data: rrData },
    ] = await Promise.all([
      supabase.from("players").select("*").eq("org_id", activeOrgId).order("number"),
      supabase.from("sessions").select("id, level, round_number, group_number, date").eq("org_id", activeOrgId),
      supabase.from("session_players").select("session_id, player_number").eq("org_id", activeOrgId),
      supabase.from("rounds").select("id, level, round_number").eq("org_id", activeOrgId),
      supabase.from("round_results").select("round_id, player_number, result").eq("org_id", activeOrgId),
    ])
    if (playerData) setPlayers(playerData)
    if (sessionData) setSessions(sessionData as Session[])
    if (spData) setSessionPlayers(spData)
    if (roundData) setRounds(roundData as Round[])
    if (rrData) setRoundResults(rrData as { round_id: string; player_number: number; result: RoundResultType }[])
  }

  useEffect(() => {
    if (!activeOrgId) return
    fetchPlayers()
  }, [activeOrgId])

  const filtered = players.filter((p) => {
    if (ageFilter !== "all") {
      const ag = getAgeGroup(p.birth_year)
      if (ag !== ageFilter) return false
    }
    if (filterLevel !== "all") {
      const level = extractLevelFromTeam(p.previous_team)
      if (level !== filterLevel) return false
    }
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    return true
  })

  const progressionMap: ProgressionMap = buildProgressionMap(
    players, sessions, sessionPlayers, rounds, roundResults
  )
  const levelsWithSessions = getLevelsWithSessions(sessions)

  const parseBulkText = (text: string) => {
    setBulkError("")
    const lines = text.trim().split("\n").filter((l) => l.trim())
    const parsed: BulkRow[] = []
    const existingNumbers = new Set(players.map((p) => p.number))
    const seenNumbers = new Set<number>()

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((s) => s.trim().replace(/^"|"$/g, ""))
      const num = parseInt(parts[0], 10)
      if (isNaN(num)) {
        setBulkError(`Line ${i + 1}: "${parts[0]}" is not a valid number`)
        return
      }
      if (existingNumbers.has(num)) {
        setBulkError(`Line ${i + 1}: #${num} already exists`)
        return
      }
      if (seenNumbers.has(num)) {
        setBulkError(`Line ${i + 1}: #${num} is duplicated in your paste`)
        return
      }
      seenNumbers.add(num)
      const yr = parseInt(parts[5], 10)
      parsed.push({
        number: num,
        first_name: parts[1] || undefined,
        last_name: parts[2] || undefined,
        previous_team: parts[3] || undefined,
        position: parts[4] || undefined,
        birth_year: !isNaN(yr) ? yr : undefined,
        notes: parts[6] || undefined,
      })
    }
    setBulkPreview(parsed)
  }

  const handleBulkImport = async () => {
    if (bulkPreview.length === 0) return
    setBulkLoading(true)
    try {
      const result = await bulkCreatePlayers(bulkPreview)
      setBulkOpen(false)
      setBulkText("")
      setBulkPreview([])
      fetchPlayers()
      alert(`Imported ${result.inserted} players`)
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setBulkLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const yr = Number(form.get("birth_year"))
    const newNumber = Number(form.get("number"))
    const data = {
      number: newNumber,
      first_name: form.get("first_name") as string || undefined,
      last_name: form.get("last_name") as string || undefined,
      previous_team: (form.get("previous_team") as string) === "__none__" ? null : (form.get("previous_team") as string) || undefined,
      position: form.get("position") as string || undefined,
      birth_year: yr || undefined,
      notes: form.get("notes") as string || undefined,
      entry_level: (form.get("entry_level") as string) === "__none__" ? null : (form.get("entry_level") as PlayerLevel) || undefined,
      current_level: (form.get("current_level") as string) === "__none__" ? null : (form.get("current_level") as PlayerLevel) || undefined,
    }

    try {
      if (editing) {
        const numberChanged = editing.number !== newNumber
        let survivingId = editing.id
        if (numberChanged) {
          const conflict = players.find((p) => p.number === newNumber && p.id !== editing.id)
          if (conflict) {
            const editingName = playerName(editing.first_name, editing.last_name, editing.number)
            const conflictName = playerName(conflict.first_name, conflict.last_name, conflict.number)
            if (!confirm(`Reassign #${newNumber} to ${editingName}?\n\n#${newNumber} (${conflictName}) will be deleted.\nAll session assignments from both numbers will be kept.`)) {
              return
            }
          }
          survivingId = await changePlayerNumber(editing.id, editing.number, newNumber)
          // Update editing state so retries use surviving player ID
          setEditing((prev) => prev ? { ...prev, id: survivingId, number: newNumber } : null)
        }
        const { number: _, ...rest } = data
        await updatePlayer(survivingId, {
          ...(numberChanged ? rest : data),
          status: form.get("status") as PlayerStatus,
          team_placed: form.get("team_placed") as string || null,
        })
      } else {
        await createPlayer(data)
      }
      setDialogOpen(false)
      setEditing(null)
      fetchPlayers()
    } catch (err) {
      fetchPlayers()
      alert(err instanceof Error ? err.message : "Failed to save player")
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this player?")) return
    await deletePlayer(id)
    fetchPlayers()
  }

  const openEdit = (player: Player) => {
    setEditing(player)
    setDialogOpen(true)
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="app-page-title">Players</h1>
        <div className="admin-filters">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null) }}>
            <DialogTrigger className="btn-primary">Add Player</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Player" : "Add Player"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="admin-form">
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <Label htmlFor="number">Jersey #</Label>
                    <Input id="number" name="number" type="number" required defaultValue={editing?.number} />
                  </div>
                  <div className="admin-form-field">
                    <Label htmlFor="position">Position</Label>
                    <Input id="position" name="position" placeholder="C, LW, RW, D, G" defaultValue={editing?.position || ""} />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input id="first_name" name="first_name" defaultValue={editing?.first_name || ""} />
                  </div>
                  <div className="admin-form-field">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input id="last_name" name="last_name" defaultValue={editing?.last_name || ""} />
                  </div>
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <Label htmlFor="previous_team">Previous Team</Label>
                    <Select name="previous_team" defaultValue={editing?.previous_team || "__none__"}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">N/A</SelectItem>
                        {PREVIOUS_TEAM_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="admin-form-field">
                    <Label htmlFor="birth_year">Birth Year</Label>
                    <Input id="birth_year" name="birth_year" type="number" placeholder="2014" defaultValue={editing?.birth_year || ""} />
                  </div>
                </div>
                <div className="admin-form-field">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" name="notes" defaultValue={editing?.notes || ""} />
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <Label htmlFor="entry_level">Entry Level</Label>
                    <Select name="entry_level" defaultValue={editing?.entry_level || "__none__"}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">N/A</SelectItem>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="admin-form-field">
                    <Label htmlFor="current_level">Current Level</Label>
                    <Select name="current_level" defaultValue={editing?.current_level || "__none__"}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">N/A</SelectItem>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editing && (
                  <>
                    <div className="admin-form-field">
                      <Label htmlFor="status">Status</Label>
                      <Select name="status" defaultValue={editing.status}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="admin-form-field">
                      <Label htmlFor="team_placed">Team Placed</Label>
                      <Input id="team_placed" name="team_placed" defaultValue={editing.team_placed || ""} />
                    </div>
                  </>
                )}
                <button type="submit" className="btn-primary">
                  {editing ? "Update" : "Add"} Player
                </button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) { setBulkText(""); setBulkPreview([]); setBulkError("") } }}>
            <DialogTrigger className="btn-secondary">Bulk Import</DialogTrigger>
            <DialogContent className="bulk-import-dialog">
              <DialogHeader>
                <DialogTitle>Bulk Import Players</DialogTitle>
                <DialogDescription>
                  Paste tab-separated or comma-separated data. One player per line.
                </DialogDescription>
              </DialogHeader>
              <div className="admin-form">
                <div className="bulk-format-hint">
                  <span className="bulk-format-label">Format:</span>
                  <code className="bulk-format-code">Jersey #, First Name, Last Name, Previous Team, Position, Birth Year, Notes</code>
                </div>
                <div className="bulk-format-hint">
                  <span className="bulk-format-label">Example:</span>
                  <code className="bulk-format-code">47, Connor, Smith, Wolves, C, 2014{"\n"}23, Marcus, Lee, Hawks, D, 2014{"\n"}91, Tyler, Brown, , G, 2013</code>
                </div>
                <Textarea
                  className="bulk-textarea"
                  placeholder={"47, Connor, Smith, Wolves, C, 2014\n23, Marcus, Lee, Hawks, D, 2014\n91, Tyler, Brown, , G, 2013"}
                  rows={10}
                  value={bulkText}
                  onChange={(e) => {
                    setBulkText(e.target.value)
                    parseBulkText(e.target.value)
                  }}
                />
                {bulkError && <p className="bulk-error">{bulkError}</p>}
                {bulkPreview.length > 0 && !bulkError && (
                  <div className="bulk-preview">
                    <p className="bulk-preview-count">{bulkPreview.length} players ready to import</p>
                    <div className="bulk-preview-list">
                      {bulkPreview.slice(0, 10).map((p) => (
                        <div key={p.number} className="bulk-preview-row">
                          <span className="bulk-preview-num">#{p.number}</span>
                          <span>{playerName(p.first_name, p.last_name)}</span>
                          <span className="bulk-preview-team">{p.previous_team || "—"}</span>
                          {p.position && <span className="bulk-preview-team">{p.position}</span>}
                          {p.birth_year && <span className="bulk-preview-team">{p.birth_year}</span>}
                        </div>
                      ))}
                      {bulkPreview.length > 10 && (
                        <p className="bulk-preview-more">+ {bulkPreview.length - 10} more</p>
                      )}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  disabled={bulkPreview.length === 0 || !!bulkError || bulkLoading}
                  onClick={handleBulkImport}
                >
                  {bulkLoading ? "Importing..." : `Import ${bulkPreview.length} Players`}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="feed-filters">
        <button className={`feed-filter-btn${ageFilter === "all" ? " active" : ""}`} onClick={() => setAgeFilter("all")}>All</button>
        <button className={`feed-filter-btn${ageFilter === "U13" ? " active" : ""}`} onClick={() => setAgeFilter("U13")}>U13</button>
        <button className={`feed-filter-btn${ageFilter === "U15" ? " active" : ""}`} onClick={() => setAgeFilter("U15")}>U15</button>
      </div>
      <div className="feed-filters">
        <button className={`feed-filter-btn${filterLevel === "all" ? " active" : ""}`} onClick={() => setFilterLevel("all")}>All</button>
        {LEVELS.map((l) => (
          <button key={l} className={`feed-filter-btn${filterLevel === l ? " active" : ""}`} onClick={() => setFilterLevel(l)}>{l}</button>
        ))}
      </div>
      <div className="feed-filters">
        <button className={`feed-filter-btn${filterStatus === "all" ? " active" : ""}`} onClick={() => setFilterStatus("all")}>All Statuses</button>
        {STATUSES.map((s) => (
          <button key={s} className={`feed-filter-btn${filterStatus === s ? " active" : ""}`} onClick={() => setFilterStatus(s)}>{s.replace(/_/g, " ")}</button>
        ))}
      </div>
      <div className="prog-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Prev Team</TableHead>
              <TableHead>Birth Year</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Team</TableHead>
              {showLevelDetails && LEVELS.map((l) => (
                <TableHead key={l} colSpan={2} className="prog-level-header">{l}</TableHead>
              ))}
              <TableHead>
                <button
                  className="prog-toggle"
                  onClick={() => setShowLevelDetails(!showLevelDetails)}
                >
                  {showLevelDetails ? "Hide" : "Details"}
                </button>
              </TableHead>
            </TableRow>
            {showLevelDetails && (
              <TableRow>
                <TableHead colSpan={8} />
                {LEVELS.map((l) => (
                  <Fragment key={l}>
                    <TableHead className="prog-sub-header">Sessions</TableHead>
                    <TableHead className="prog-sub-header">Result</TableHead>
                  </Fragment>
                ))}
                <TableHead />
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {filtered.map((player) => {
              const status = getOverallStatus(player, progressionMap, levelsWithSessions)
              const playerProg = progressionMap.get(player.number)
              return (
                <TableRow key={player.id} className={status.rowClass || ""}>
                  <TableCell className="admin-cell-number">{player.number}</TableCell>
                  <TableCell>{playerName(player.first_name, player.last_name)}</TableCell>
                  <TableCell>{player.position || "—"}</TableCell>
                  <TableCell>{player.previous_team || "—"}</TableCell>
                  <TableCell>{player.birth_year || "—"}</TableCell>
                  <TableCell>
                    <span className="level-badge">{player.current_level || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`prog-status${status.color ? ` ${status.color}` : ""}`}>
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="prog-team">{player.team_placed || "—"}</TableCell>
                  {showLevelDetails && LEVELS.map((l) => {
                    const entry = playerProg?.get(l as PlayerLevel)
                    return (
                      <Fragment key={l}>
                        <TableCell className="prog-cell prog-sessions">
                          {entry?.sessions.length ? entry.sessions.join(", ") : <span className="prog-dash">—</span>}
                        </TableCell>
                        <TableCell className={`prog-cell${entry?.resultColor ? ` ${entry.resultColor}` : ""}`}>
                          {entry?.result || <span className="prog-dash">—</span>}
                        </TableCell>
                      </Fragment>
                    )
                  })}
                  <TableCell>
                    <div className="admin-actions">
                      <button className="admin-action-btn" onClick={() => openEdit(player)}>Edit</button>
                      <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(player.id)}>Delete</button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={showLevelDetails ? 19 : 9} className="admin-empty-cell">No players found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
