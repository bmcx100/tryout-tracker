"use client"

import { Home, Heart, Shield, UserSearch, Zap } from "lucide-react"
import { useState } from "react"

const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "tryouts", label: "Tryouts", icon: Zap },
  { id: "crew", label: "My Crew", icon: Heart },
  { id: "teams", label: "Teams", icon: Shield },
  { id: "players", label: "Players", icon: UserSearch },
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
