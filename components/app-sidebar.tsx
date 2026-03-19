"use client"

import { Home, Heart, Shield, UserSearch, Zap, Settings } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/current", label: "Tryouts", icon: Zap },
  { href: "/crew", label: "My Crew", icon: Heart },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/players", label: "Players", icon: UserSearch },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">TRYOUT TRACKER</div>
      <nav className="app-sidebar-items">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-sidebar-item${isActive ? " active" : ""}`}
            >
              <Icon className="app-sidebar-icon" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        {profile?.role === "admin" && (
          <Link
            href="/admin"
            className={`app-sidebar-item${pathname.startsWith("/admin") ? " active" : ""}`}
          >
            <Settings className="app-sidebar-icon" />
            <span>Admin</span>
          </Link>
        )}
      </nav>
      <div className="app-sidebar-footer">
        Tryout Tracker v0.1.0
      </div>
    </aside>
  )
}
