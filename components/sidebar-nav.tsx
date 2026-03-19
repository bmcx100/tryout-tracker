"use client"

import { Home, Heart, Shield, UserSearch, Zap } from "lucide-react"
import { useState } from "react"

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "tryouts", label: "Tryouts", icon: Zap },
  { id: "crew", label: "My Crew", icon: Heart },
  { id: "teams", label: "Teams", icon: Shield },
  { id: "players", label: "Players", icon: UserSearch },
]

export function SidebarNav() {
  const [active, setActive] = useState("crew")

  return (
    <aside className="sidebar-nav">
      <div className="sidebar-brand">TRYOUT TRACKER</div>
      <nav className="sidebar-items">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              className={`sidebar-item${active === item.id ? " active" : ""}`}
              onClick={() => setActive(item.id)}
            >
              <Icon className="sidebar-icon" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="sidebar-footer">
        Tryout Tracker v0.1.0
      </div>
    </aside>
  )
}
