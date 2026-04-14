"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { Profile, Organization } from "@/lib/types"

interface UserOrg {
  org_id: string
  role: string
  organizations: Organization
}

interface AuthContext {
  user: User | null
  profile: Profile | null
  activeOrgId: string | null
  orgRole: string | null
  userOrgs: UserOrg[]
  loading: boolean
  signOut: () => Promise<void>
  refreshOrgs: () => Promise<void>
}

const AuthContext = createContext<AuthContext>({
  user: null,
  profile: null,
  activeOrgId: null,
  orgRole: null,
  userOrgs: [],
  loading: true,
  signOut: async () => {},
  refreshOrgs: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([])
  const [loading, setLoading] = useState(true)
  const hadUser = useRef(false)
  const supabase = createClient()
  const router = useRouter()

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
    if (error) console.error("[auth] fetchProfile error:", error.message, error.code)
    setProfile(data)
    return data
  }

  const fetchOrgs = async (userId: string) => {
    const { data, error } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, slug)")
      .eq("user_id", userId)
      .neq("role", "pending")
    if (error) console.error("[auth] fetchOrgs error:", error.message, error.code)
    setUserOrgs((data as unknown as UserOrg[]) || [])
    return (data as unknown as UserOrg[]) || []
  }

  const refreshOrgs = async () => {
    if (user) {
      await fetchOrgs(user.id)
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    const loadUserData = async (authUser: User) => {
      try {
        // Force browser client to sync with latest cookies from middleware
        await supabase.auth.getSession()

        let profileData = await fetchProfile(authUser.id)
        const orgsData = await fetchOrgs(authUser.id)

        // Retry profile once if null (trigger may not have fired yet)
        if (!profileData) {
          console.warn("[auth] profile null on first try — retrying")
          await new Promise((r) => setTimeout(r, 500))
          profileData = await fetchProfile(authUser.id)
        }

        // Auto-fix: patch missing profile fields
        const patches: Record<string, string> = {}
        if (!profileData?.active_org_id && orgsData.length > 0) {
          patches.active_org_id = orgsData[0].org_id
        }
        if (!profileData?.display_name) {
          const name = authUser.user_metadata?.full_name
            || authUser.user_metadata?.name
          if (name) patches.display_name = name
        }
        if (Object.keys(patches).length > 0) {
          console.debug("[auth] auto-patching profile:", patches)
          const { error: patchError } = await supabase
            .from("profiles")
            .update(patches)
            .eq("id", authUser.id)
          if (patchError) console.error("[auth] patch error:", patchError.message)
          else await fetchProfile(authUser.id)
        }
      } catch (err) {
        console.error("[auth] loadUserData error:", err)
      } finally {
        setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          hadUser.current = true
          await loadUserData(currentUser)
        } else {
          setProfile(null)
          setUserOrgs([])
          setLoading(false)
          if (hadUser.current) {
            router.push("/login")
          }
        }
      }
    )

    // Safety timeout — if onAuthStateChange never fires (edge case)
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) console.warn("[auth] safety timeout — forcing loading=false")
        return false
      })
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setUserOrgs([])
  }

  const activeOrgId = profile?.active_org_id ?? null
  const orgRole = activeOrgId
    ? (userOrgs.find((o) => o.org_id === activeOrgId)?.role ?? null)
    : null

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      activeOrgId,
      orgRole,
      userOrgs,
      loading,
      signOut,
      refreshOrgs,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
