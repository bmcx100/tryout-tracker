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
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
    setProfile(data)
    return data
  }

  const fetchOrgs = async (userId: string) => {
    const { data } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, slug)")
      .eq("user_id", userId)
      .neq("role", "pending")
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
    const getInitialSession = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      if (authUser) {
        hadUser.current = true
        await fetchProfile(authUser.id)
        await fetchOrgs(authUser.id)
      }
      setLoading(false)
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "INITIAL_SESSION") return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          hadUser.current = true
          if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            await fetchProfile(currentUser.id)
            await fetchOrgs(currentUser.id)
          }
        } else {
          setProfile(null)
          setUserOrgs([])
          if (hadUser.current) {
            router.push("/login")
          }
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
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
