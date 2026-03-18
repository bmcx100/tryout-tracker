"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

export function AppHeaderAuth() {
  const { profile, signOut } = useAuth()
  const router = useRouter()

  const initials = profile?.display_name
    ? profile.display_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  return (
    <header className="app-header-auth">
      <span className="app-header-auth-brand">CABOT</span>
      <DropdownMenu>
        <DropdownMenuTrigger className="app-header-auth-trigger">
          <Avatar className="app-header-auth-avatar">
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="app-header-auth-label">
            <span>{profile?.display_name || profile?.email}</span>
            <Badge variant="outline" className="app-header-auth-badge">
              {profile?.role}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
