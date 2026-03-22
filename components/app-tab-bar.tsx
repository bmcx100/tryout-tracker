"use client"

import { Home, UserSearch, Zap } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"

const TABS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/current", label: "Tryouts", icon: Zap },
  { href: "/players", label: "Players", icon: UserSearch },
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
