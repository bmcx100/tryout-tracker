"use client"

import { submitCorrection } from "@/lib/actions/corrections"
import type { CorrectionEntityType } from "@/lib/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function CorrectionForm({
  open,
  onOpenChange,
  entityType,
  entityId,
  playerNumber,
  field,
  currentValue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: CorrectionEntityType
  entityId: string
  playerNumber?: number
  field: string
  currentValue: string
}) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await submitCorrection({
        player_number: playerNumber,
        entity_type: entityType,
        entity_id: entityId,
        field,
        current_value: currentValue,
        suggested_value: form.get("suggested_value") as string,
      })
      toast.success("Correction submitted")
      onOpenChange(false)
    } catch {
      toast.error("Failed to submit correction")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest a Correction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="admin-form-field">
            <Label>Field</Label>
            <Input value={field} readOnly />
          </div>
          <div className="admin-form-field">
            <Label>Current Value</Label>
            <Input value={currentValue} readOnly />
          </div>
          <div className="admin-form-field">
            <Label>Suggested Value</Label>
            <Textarea name="suggested_value" required placeholder="What should it be?" />
          </div>
          <button type="submit" className="btn-primary">Submit Correction</button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
