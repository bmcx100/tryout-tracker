"use client"

import { ChevronRight } from "lucide-react"
import type { PositionGroup, UserCompetitionPrefs } from "@/lib/types"

interface StepPositionProps {
  existingPrefs: UserCompetitionPrefs[]
  onSelect: (group: PositionGroup, reuseTeamOrder: string[] | null) => void
}

const POSITION_LABELS: Record<PositionGroup, string> = {
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
}

export function StepPosition({ existingPrefs, onSelect }: StepPositionProps) {
  const mostRecent = existingPrefs.length > 0 ? existingPrefs[0] : null
  const completedGroups = new Set(existingPrefs.map((p) => p.position_group))

  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Pick a position</h1>
      <p className="wizard-subtext">
        You'll rank the teams, then see where everyone lands.
      </p>

      <div className="wizard-cards">
        {(["forwards", "defense", "goalies"] as PositionGroup[]).map((group) => (
          <button
            key={group}
            className="wizard-card"
            onClick={() => onSelect(group, null)}
          >
            {POSITION_LABELS[group]}
            <ChevronRight size={20} className="wizard-card-arrow" />
          </button>
        ))}
      </div>

      {mostRecent && (
        <div>
          {(["forwards", "defense", "goalies"] as PositionGroup[])
            .filter((g) => !completedGroups.has(g))
            .slice(0, 1)
            .map((group) => (
              <button
                key={group}
                className="wizard-reuse-option"
                onClick={() => onSelect(group, mostRecent.team_order)}
              >
                Start {POSITION_LABELS[group]} with your {POSITION_LABELS[mostRecent.position_group]} team order
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
