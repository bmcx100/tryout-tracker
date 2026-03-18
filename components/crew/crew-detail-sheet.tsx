"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { updateCrewMember, removeFromCrew } from "@/lib/actions/crew"
import type { CrewMember, CrewTag, RoundResultRecord } from "@/lib/types"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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

const TAGS: { value: CrewTag; label: string }[] = [
  { value: "bff", label: "BFF" },
  { value: "teammate", label: "Teammate" },
  { value: "old_teammate", label: "Old Teammate" },
  { value: "friend", label: "Friend" },
]

interface RoundResultWithRound extends RoundResultRecord {
  round?: { level: string; round_number: number; date: string }
}

export function CrewDetailSheet({
  member,
  open,
  onOpenChange,
  onUpdated,
}: {
  member: CrewMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}) {
  const [history, setHistory] = useState<RoundResultWithRound[]>([])

  useEffect(() => {
    if (!member) return
    const fetchHistory = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("round_results")
        .select("*, round:rounds(*)")
        .eq("player_number", member.player_number)
        .order("id", { ascending: false })
      if (data) setHistory(data)
    }
    fetchHistory()
  }, [member])

  if (!member) return null

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await updateCrewMember(member.id, {
        personal_name: form.get("personal_name") as string,
        tag: form.get("tag") as CrewTag,
        notes: (form.get("notes") as string) || null,
      })
      toast.success("Crew member updated")
      onUpdated()
    } catch {
      toast.error("Failed to update")
    }
  }

  const handleRemove = async () => {
    if (!confirm("Remove from your crew?")) return
    try {
      await removeFromCrew(member.id)
      toast.success("Removed from crew")
      onOpenChange(false)
      onUpdated()
    } catch {
      toast.error("Failed to remove")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="crew-detail-sheet">
        <SheetHeader>
          <SheetTitle className="crew-detail-title">
            #{member.player_number} {member.personal_name}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSave} className="crew-detail-form">
          <div className="admin-form-field">
            <Label>Your Name for Them</Label>
            <Input name="personal_name" defaultValue={member.personal_name} required />
          </div>
          <div className="admin-form-field">
            <Label>Tag</Label>
            <Select name="tag" defaultValue={member.tag}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAGS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="admin-form-field">
            <Label>Notes</Label>
            <Textarea name="notes" defaultValue={member.notes || ""} />
          </div>
          <div className="crew-detail-actions">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" className="btn-secondary" onClick={handleRemove}>
              Remove from Crew
            </button>
          </div>
        </form>

        {member.player && (
          <div className="crew-detail-info">
            <div className="crew-detail-stat">
              <span className="crew-detail-stat-label">Current Level</span>
              <span className="crew-detail-stat-value">{member.player.current_level || "—"}</span>
            </div>
            <div className="crew-detail-stat">
              <span className="crew-detail-stat-label">Status</span>
              <span className="crew-detail-stat-value">{(member.player.status || "").replace(/_/g, " ")}</span>
            </div>
            <div className="crew-detail-stat">
              <span className="crew-detail-stat-label">Position</span>
              <span className="crew-detail-stat-value">{member.player.position || "—"}</span>
            </div>
            <div className="crew-detail-stat">
              <span className="crew-detail-stat-label">Previous Team</span>
              <span className="crew-detail-stat-value">{member.player.previous_team || "—"}</span>
            </div>
            {member.player.birth_year && (
              <div className="crew-detail-stat">
                <span className="crew-detail-stat-label">Birth Year</span>
                <span className="crew-detail-stat-value">{member.player.birth_year}</span>
              </div>
            )}
          </div>
        )}

        {history.length > 0 && (
          <div className="crew-detail-history">
            <h3 className="crew-detail-section-title">Tryout History</h3>
            {history.map((r) => (
              <div key={r.id} className="feed-item">
                <span className="feed-item-time">
                  {r.round?.date || "—"}
                </span>
                <div className="feed-item-content">
                  <span className="feed-item-player">
                    {r.round?.level} Round {r.round?.round_number}
                  </span>
                  <span className="feed-item-desc">
                    {r.result.replace(/_/g, " ")}
                    {r.notes && ` — ${r.notes}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
