"use client"

import { Users, Activity, Calendar, Search } from "lucide-react"
import { useState } from "react"

const NAV_ITEMS = [
  { id: "crew", label: "Crew", icon: Users },
  { id: "feed", label: "Feed", icon: Activity },
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "explore", label: "Explore", icon: Search },
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
