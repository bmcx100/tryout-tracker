"use client"

import { addToCrew } from "@/lib/actions/crew"
import type { CrewTag } from "@/lib/types"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const TAGS: { value: CrewTag; label: string }[] = [
  { value: "bff", label: "BFF" },
  { value: "teammate", label: "Teammate" },
  { value: "old_teammate", label: "Old Teammate" },
  { value: "friend", label: "Friend" },
]

export function AddToCrewDialog({
  open,
  onOpenChange,
  playerNumber,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  playerNumber?: number
  onAdded: () => void
}) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await addToCrew({
        player_number: Number(form.get("player_number")),
        personal_name: form.get("personal_name") as string,
        tag: form.get("tag") as CrewTag,
      })
      toast.success("Added to your crew!")
      onOpenChange(false)
      onAdded()
    } catch {
      toast.error("Failed to add to crew")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to Your Crew</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-field">
            <Label>Player Number</Label>
            <Input
              name="player_number"
              type="number"
              required
              defaultValue={playerNumber}
              readOnly={!!playerNumber}
            />
          </div>
          <div className="admin-form-field">
            <Label>Your Name for Them</Label>
            <Input name="personal_name" placeholder="e.g. Connor" required />
          </div>
          <div className="admin-form-field">
            <Label>Relationship</Label>
            <Select name="tag" defaultValue="friend">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TAGS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button type="submit" className="btn-primary">Add to Crew</button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
