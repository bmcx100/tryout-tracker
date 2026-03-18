"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createPlayer, updatePlayer, deletePlayer, bulkCreatePlayers } from "@/lib/actions/players"
import type { Player, PlayerLevel, PlayerStatus } from "@/lib/types"
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
  const [filterLevel, setFilterLevel] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const [bulkPreview, setBulkPreview] = useState<BulkRow[]>([])
  const [bulkError, setBulkError] = useState("")
  const [bulkLoading, setBulkLoading] = useState(false)

  const supabase = createClient()

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .order("number")
    if (data) setPlayers(data)
  }

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("players")
        .select("*")
        .order("number")
      if (data) setPlayers(data)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = players.filter((p) => {
    if (filterLevel !== "all" && p.current_level !== filterLevel) return false
    if (filterStatus !== "all" && p.status !== filterStatus) return false
    return true
  })

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
    const data = {
      number: Number(form.get("number")),
      first_name: form.get("first_name") as string || undefined,
      last_name: form.get("last_name") as string || undefined,
      previous_team: form.get("previous_team") as string || undefined,
      position: form.get("position") as string || undefined,
      birth_year: yr || undefined,
      notes: form.get("notes") as string || undefined,
      previous_level: (form.get("previous_level") as PlayerLevel) || undefined,
      entry_level: (form.get("entry_level") as PlayerLevel) || undefined,
      current_level: (form.get("current_level") as PlayerLevel) || undefined,
    }

    if (editing) {
      await updatePlayer(editing.id, {
        ...data,
        status: form.get("status") as PlayerStatus,
        team_placed: form.get("team_placed") as string || null,
      })
    } else {
      await createPlayer(data)
    }

    setDialogOpen(false)
    setEditing(null)
    fetchPlayers()
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
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger className="admin-filter-select">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="admin-filter-select">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <Input id="previous_team" name="previous_team" defaultValue={editing?.previous_team || ""} />
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
                    <Label htmlFor="previous_level">Previous Level</Label>
                    <Select name="previous_level" defaultValue={editing?.previous_level || ""}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="admin-form-field">
                    <Label htmlFor="entry_level">Entry Level</Label>
                    <Select name="entry_level" defaultValue={editing?.entry_level || ""}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="admin-form-field">
                    <Label htmlFor="current_level">Current Level</Label>
                    <Select name="current_level" defaultValue={editing?.current_level || ""}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
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
                          <span>{[p.first_name, p.last_name].filter(Boolean).join(" ") || "—"}</span>
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
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((player) => (
            <TableRow key={player.id}>
              <TableCell className="admin-cell-number">{player.number}</TableCell>
              <TableCell>{[player.first_name, player.last_name].filter(Boolean).join(" ") || "—"}</TableCell>
              <TableCell>{player.position || "—"}</TableCell>
              <TableCell>{player.previous_team || "—"}</TableCell>
              <TableCell>{player.birth_year || "—"}</TableCell>
              <TableCell>
                <span className="level-badge">{player.current_level || "—"}</span>
              </TableCell>
              <TableCell>
                <span className={`status-badge status-${player.status === "active_tryout" ? "active" : player.status === "placed_on_team" ? "placed" : "cut"}`}>
                  {player.status.replace(/_/g, " ")}
                </span>
              </TableCell>
              <TableCell>
                <div className="admin-actions">
                  <button className="admin-action-btn" onClick={() => openEdit(player)}>Edit</button>
                  <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(player.id)}>Delete</button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="admin-empty-cell">No players found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
