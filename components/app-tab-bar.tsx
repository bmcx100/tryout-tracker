"use client"

import { Users, Activity, Calendar, Search } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"

const TABS = [
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/feed", label: "Feed", icon: Activity },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/explore", label: "Explore", icon: Search },
]

export function AppTabBar() {
  const pathname = usePathname()

  return (
    <nav className="app-tab-bar">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-tab-item${isActive ? " active" : ""}`}
          >
            <Icon className="app-tab-icon" />
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
