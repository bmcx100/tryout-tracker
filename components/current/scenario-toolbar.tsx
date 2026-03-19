"use client"

import { useState } from "react"
import { Save, Trash2, RotateCcw, Share2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export interface ScenarioSummary {
  id: string
  name: string
  user_id: string
  is_shared: boolean
  updated_at: string
  isOwn: boolean
}

export function ScenarioToolbar({
  activeScenarioId,
  savedScenarios,
  isDirty,
  onSelectScenario,
  onSave,
  onSaveAs,
  onDelete,
  onReset,
  onToggleShared,
}: {
  activeScenarioId: string
  savedScenarios: ScenarioSummary[]
  isDirty: boolean
  onSelectScenario: (id: string) => void
  onSave: () => void
  onSaveAs: (name: string) => void
  onDelete: () => void
  onReset: () => void
  onToggleShared: (id: string, shared: boolean) => void
}) {
  const [saveAsOpen, setSaveAsOpen] = useState(false)
  const [saveAsName, setSaveAsName] = useState("")
  const { profile } = useAuth()
  const isAdmin = profile?.role === "admin"

  const isDefault = activeScenarioId.startsWith("__")
  const activeScenario = savedScenarios.find((s) => s.id === activeScenarioId)
  const isOwn = activeScenario?.isOwn ?? false
  const isShared = activeScenario?.is_shared ?? false

  const sharedScenarios = savedScenarios.filter((s) => s.is_shared && !s.isOwn)
  const ownScenarios = savedScenarios.filter((s) => s.isOwn)

  const handleSaveAs = () => {
    const name = saveAsName.trim()
    if (!name) return
    onSaveAs(name)
    setSaveAsName("")
    setSaveAsOpen(false)
  }

  return (
    <div className="scenario-toolbar">
      <div className="scenario-toolbar-select">
        <Select value={activeScenarioId} onValueChange={onSelectScenario}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__fresh_build__">Fresh Build</SelectItem>
            {sharedScenarios.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>Shared</SelectLabel>
                  {sharedScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
            {ownScenarios.length > 0 && (
              <>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel>My Scenarios</SelectLabel>
                  {ownScenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {!isDefault && isOwn && (
        <button
          className={`scenario-toolbar-btn${isDirty ? " dirty" : ""}`}
          onClick={onSave}
          disabled={!isDirty}
        >
          <Save className="scenario-toolbar-icon" />
          Save
        </button>
      )}

      <button
        className="scenario-toolbar-btn"
        onClick={() => setSaveAsOpen(true)}
      >
        Save As
      </button>

      {isAdmin && !isDefault && isOwn && (
        <button
          className={`scenario-toolbar-btn${isShared ? " shared" : ""}`}
          onClick={() => onToggleShared(activeScenarioId, !isShared)}
          title={isShared ? "Stop sharing" : "Share with everyone"}
        >
          <Share2 className="scenario-toolbar-icon" />
        </button>
      )}

      {!isDefault && isOwn && (
        <button className="scenario-toolbar-btn delete" onClick={onDelete}>
          <Trash2 className="scenario-toolbar-icon" />
        </button>
      )}

      <button className="scenario-toolbar-btn" onClick={onReset}>
        <RotateCcw className="scenario-toolbar-icon" />
      </button>

      <Dialog open={saveAsOpen} onOpenChange={setSaveAsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Scenario As</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Scenario name..."
            value={saveAsName}
            onChange={(e) => setSaveAsName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveAs()}
          />
          <DialogFooter>
            <button className="scenario-toolbar-btn" onClick={() => setSaveAsOpen(false)}>
              Cancel
            </button>
            <button className="scenario-toolbar-btn save" onClick={handleSaveAs} disabled={!saveAsName.trim()}>
              Save
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
