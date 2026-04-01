"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogIn } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { OrgSwitcher } from "@/components/org-switcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function AppHeaderAuth() {
  const { user, profile, loading, signOut } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <header className="app-header-auth">
      <span className="app-header-auth-brand">TRYOUT TRACKER</span>
      {!loading && !user ? (
        <Link href="/login" className="app-header-login-btn">
          <LogIn className="app-header-login-icon" />
          <span>Sign In</span>
        </Link>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger className="app-header-auth-trigger">
            <Avatar className="app-header-auth-avatar">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="app-header-auth-label">
              {profile?.display_name && (
                <span>{profile.display_name}</span>
              )}
              <span className="app-header-auth-email">{user?.email}</span>
              <OrgSwitcher />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
