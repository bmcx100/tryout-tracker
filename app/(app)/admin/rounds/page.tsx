"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { createRound, recordRoundResults } from "@/lib/actions/rounds"
import type { Round, Player, PlayerLevel, RoundResult } from "@/lib/types"
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
const RESULTS: RoundResult[] = ["advanced", "cut_down", "withdrawn", "placed"]

export default function AdminRoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [selectedRound, setSelectedRound] = useState<Round | null>(null)
  const [resultEntries, setResultEntries] = useState<Array<{ player_number: number; result: RoundResult }>>([])

  const supabase = createClient()

  const fetchData = async () => {
    const [{ data: roundData }, { data: playerData }] = await Promise.all([
      supabase.from("rounds").select("*").order("date", { ascending: false }),
      supabase.from("players").select("*").order("number"),
    ])
    if (roundData) setRounds(roundData)
    if (playerData) setPlayers(playerData)
  }

  useEffect(() => {
    const load = async () => {
      const [{ data: roundData }, { data: playerData }] = await Promise.all([
        supabase.from("rounds").select("*").order("date", { ascending: false }),
        supabase.from("players").select("*").order("number"),
      ])
      if (roundData) setRounds(roundData)
      if (playerData) setPlayers(playerData)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateRound = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await createRound({
      level: form.get("level") as PlayerLevel,
      round_number: Number(form.get("round_number")),
      date: form.get("date") as string,
      notes: form.get("notes") as string || undefined,
    })
    setAddOpen(false)
    fetchData()
  }

  const openResults = (round: Round) => {
    setSelectedRound(round)
    const levelPlayers = players.filter((p) => p.current_level === round.level && p.status === "active_tryout")
    setResultEntries(levelPlayers.map((p) => ({ player_number: p.number, result: "advanced" as RoundResult })))
    setResultsOpen(true)
  }

  const handleRecordResults = async () => {
    if (!selectedRound) return
    await recordRoundResults(selectedRound.id, resultEntries)
    setResultsOpen(false)
    fetchData()
  }

  return (
    <div>
      <div className="admin-page-header">
        <h1 className="app-page-title">Rounds</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger className="btn-primary">Add Round</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Round</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateRound} className="admin-form">
              <div className="admin-form-row">
                <div className="admin-form-field">
                  <Label>Level</Label>
                  <Select name="level" required>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="admin-form-field">
                  <Label>Round #</Label>
                  <Input name="round_number" type="number" min={1} required />
                </div>
              </div>
              <div className="admin-form-field">
                <Label>Date</Label>
                <Input name="date" type="date" required />
              </div>
              <div className="admin-form-field">
                <Label>Notes</Label>
                <Input name="notes" />
              </div>
              <button type="submit" className="btn-primary">Add Round</button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Level</TableHead>
            <TableHead>Round</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rounds.map((round) => (
            <TableRow key={round.id}>
              <TableCell><span className="level-badge">{round.level}</span></TableCell>
              <TableCell>{round.round_number}</TableCell>
              <TableCell>{round.date}</TableCell>
              <TableCell>{round.notes || "—"}</TableCell>
              <TableCell>
                <button className="admin-action-btn" onClick={() => openResults(round)}>
                  Enter Results
                </button>
              </TableCell>
            </TableRow>
          ))}
          {rounds.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="admin-empty-cell">No rounds created</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={resultsOpen} onOpenChange={setResultsOpen}>
        <DialogContent className="admin-results-dialog">
          <DialogHeader>
            <DialogTitle>
              Enter Results — {selectedRound?.level} Round {selectedRound?.round_number}
            </DialogTitle>
          </DialogHeader>
          <div className="admin-results-list">
            {resultEntries.map((entry, i) => (
              <div key={entry.player_number} className="admin-result-row">
                <span className="admin-result-number">#{entry.player_number}</span>
                <Select
                  value={entry.result}
                  onValueChange={(val) => {
                    const updated = [...resultEntries]
                    updated[i] = { ...entry, result: val as RoundResult }
                    setResultEntries(updated)
                  }}
                >
                  <SelectTrigger className="admin-result-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULTS.map((r) => (
                      <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {resultEntries.length === 0 && (
              <p className="admin-empty-cell">No active players at this level</p>
            )}
          </div>
          <button className="btn-primary" onClick={handleRecordResults}>
            Record Results
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
