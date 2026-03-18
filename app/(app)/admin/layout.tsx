"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/rounds", label: "Rounds" },
  { href: "/admin/import", label: "Import" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/corrections", label: "Corrections" },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <div className="admin-layout">
      <nav className="admin-sub-nav">
        {ADMIN_NAV.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-sub-nav-item${isActive ? " active" : ""}`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
