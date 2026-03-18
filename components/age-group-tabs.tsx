"use client"

import { AGE_GROUPS, type AgeGroup } from "@/lib/utils"

export function AgeGroupTabs({
  active,
  onChange,
}: {
  active: AgeGroup
  onChange: (group: AgeGroup) => void
}) {
  return (
    <div className="age-group-tabs">
      {AGE_GROUPS.map((group) => (
        <button
          key={group}
          className={`age-group-tab${active === group ? " active" : ""}`}
          onClick={() => onChange(group)}
        >
          {group}
        </button>
      ))}
    </div>
  )
}
