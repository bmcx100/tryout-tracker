"use client"

import { ChevronRight } from "lucide-react"
import type { PositionGroup, UserCompetitionPrefs } from "@/lib/types"

interface StepPositionProps {
  existingPrefs: UserCompetitionPrefs[]
  onSelect: (group: PositionGroup, reuseTeamOrder: string[] | null) => void
}

const POSITION_OPTIONS: { value: PositionGroup; label: string }[] = [
  { value: "all", label: "All Players" },
  { value: "forwards", label: "Forwards" },
  { value: "defense", label: "Defense" },
  { value: "goalies", label: "Goalies" },
]

export function StepPosition({ onSelect }: StepPositionProps) {
  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Pick a position</h1>
      <p className="wizard-subtext">
        Next, you'll rank the existing teams from strongest to weakest.
      </p>

      <div className="wizard-cards">
        {POSITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="wizard-card"
            onClick={() => onSelect(opt.value, null)}
          >
            {opt.label}
            <ChevronRight size={20} className="wizard-card-arrow" />
          </button>
        ))}
      </div>
    </div>
  )
}
