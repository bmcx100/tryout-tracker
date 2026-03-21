"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { createSession, updateSession, deleteSession } from "@/lib/actions/sessions"
import type { Session, PlayerLevel } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

export default function AdminSessionsPage() {
  const { loading: authLoading } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Session | null>(null)
  const [filterLevel, setFilterLevel] = useState<string>("all")

  const supabase = createClient()

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .order("date", { ascending: false })
    if (data) setSessions(data)
  }

  useEffect(() => {
    if (authLoading) return
    const load = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("*")
        .order("date", { ascending: false })
      if (data) setSessions(data)
    }
    load()
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = sessions.filter((s) => {
    if (filterLevel !== "all" && s.level !== filterLevel) return false
    return true
  })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      level: form.get("level") as PlayerLevel,
      round_number: Number(form.get("round_number")),
      group_number: Number(form.get("group_number")),
      date: form.get("date") as string,
      start_time: form.get("start_time") as string,
      end_time: form.get("end_time") as string,
      rink: form.get("rink") as string,
      notes: form.get("notes") as string || undefined,
    }

    if (editing) {
      await updateSession(editing.id, data)
    } else {
      await createSession(data)
    }

    setDialogOpen(false)
    setEditing(null)
    fetchSessions()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session?")) return
    await deleteSession(id)
    fetchSessions()
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="app-page-title">Sessions</h1>
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
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null) }}>
            <DialogTrigger className="btn-primary">Add Session</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Session" : "Add Session"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="admin-form">
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <Label>Level</Label>
                    <Select name="level" defaultValue={editing?.level || ""} required>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="admin-form-field">
                    <Label>Round</Label>
                    <Input name="round_number" type="number" min={1} required defaultValue={editing?.round_number} />
                  </div>
                  <div className="admin-form-field">
                    <Label>Group</Label>
                    <Input name="group_number" type="number" min={1} max={4} required defaultValue={editing?.group_number} />
                  </div>
                </div>
                <div className="admin-form-field">
                  <Label>Date</Label>
                  <Input name="date" type="date" required defaultValue={editing?.date} />
                </div>
                <div className="admin-form-row">
                  <div className="admin-form-field">
                    <Label>Start Time</Label>
                    <Input name="start_time" type="time" required defaultValue={editing?.start_time} />
                  </div>
                  <div className="admin-form-field">
                    <Label>End Time</Label>
                    <Input name="end_time" type="time" required defaultValue={editing?.end_time} />
                  </div>
                </div>
                <div className="admin-form-field">
                  <Label>Rink</Label>
                  <Input name="rink" required defaultValue={editing?.rink} />
                </div>
                <div className="admin-form-field">
                  <Label>Notes</Label>
                  <Input name="notes" defaultValue={editing?.notes || ""} />
                </div>
                <button type="submit" className="btn-primary">
                  {editing ? "Update" : "Add"} Session
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Level</TableHead>
            <TableHead>Round</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Rink</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((session) => (
            <TableRow key={session.id}>
              <TableCell><span className="level-badge">{session.level}</span></TableCell>
              <TableCell>{session.round_number}</TableCell>
              <TableCell>{session.group_number}</TableCell>
              <TableCell>{session.date}</TableCell>
              <TableCell>{session.start_time} — {session.end_time}</TableCell>
              <TableCell>{session.rink}</TableCell>
              <TableCell>
                <div className="admin-actions">
                  <button className="admin-action-btn" onClick={() => { setEditing(session); setDialogOpen(true) }}>Edit</button>
                  <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(session.id)}>Delete</button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="admin-empty-cell">No sessions found</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
