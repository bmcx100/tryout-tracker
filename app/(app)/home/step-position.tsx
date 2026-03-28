"use client"

import type { PositionGroup, UserCompetitionPrefs } from "@/lib/types"

interface StepPositionProps {
  existingPrefs: UserCompetitionPrefs[]
  onSelect: (group: PositionGroup, reuseTeamOrder: string[] | null) => void
}

const POSITION_OPTIONS: { value: PositionGroup; label: string }[] = [
  { value: "forwards", label: "Forwards" },
  { value: "defense", label: "Defense" },
  { value: "goalies", label: "Goalies" },
  { value: "all", label: "All Players" },
]

export function StepPosition({ onSelect }: StepPositionProps) {
  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Pick a position</h1>
      <p className="wizard-subtext">
        Next, you'll rank the existing teams.
      </p>

      <div className="wizard-cards">
        {POSITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            className="btn-secondary-outline wizard-card"
            onClick={() => onSelect(opt.value, null)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
