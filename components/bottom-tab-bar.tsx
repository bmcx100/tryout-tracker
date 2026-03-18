"use client"

import { Users, Activity, Calendar, Search } from "lucide-react"
import { useState } from "react"

const TABS = [
  { id: "crew", label: "Crew", icon: Users },
  { id: "feed", label: "Feed", icon: Activity },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "explore", label: "Explore", icon: Search },
]

export function BottomTabBar() {
  const [active, setActive] = useState("crew")

  return (
    <nav className="bottom-tab-bar">
      {TABS.map((tab) => {
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            className={`tab-item${active === tab.id ? " active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            <Icon className="tab-icon" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
