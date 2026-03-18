"use client"

import { Users, Activity, Calendar, Search, Settings } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

const NAV_ITEMS = [
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/feed", label: "Feed", icon: Activity },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/explore", label: "Explore", icon: Search },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">CABOT</div>
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
        Cabot Tryout Crew Tracker v0.1.0
      </div>
    </aside>
  )
}
