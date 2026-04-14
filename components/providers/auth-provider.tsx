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
    else console.debug("[auth] profile:", { active_org_id: data?.active_org_id, display_name: data?.display_name })
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
    else console.debug("[auth] orgs:", data?.map((o) => ({ org_id: o.org_id, role: o.role })))
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
      hadUser.current = true
      setUser(authUser)

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
    }

    const initSession = async () => {
      // Step 1: Use getSession() for instant local read (no network call)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error("[auth] getSession error:", sessionError.message)
      }

      if (session?.user) {
        console.debug("[auth] session user:", session.user.id, session.user.email)
        await loadUserData(session.user)
        console.debug("[auth] init complete via getSession, loading → false")
        setLoading(false)

        // Step 2: Verify in background with getUser() (network call)
        // If the token was actually invalid, this will catch it
        supabase.auth.getUser().then(({ data: { user: verified }, error: verifyError }) => {
          if (verifyError || !verified) {
            console.warn("[auth] background getUser failed — session may be stale:", verifyError?.message)
            // Token was invalid, clear state and redirect
            setUser(null)
            setProfile(null)
            setUserOrgs([])
            router.push("/login")
          }
        })
        return
      }

      // No local session — fall back to getUser() (needed for fresh OAuth callback)
      console.debug("[auth] no local session, falling back to getUser()")
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.error("[auth] getUser error:", authError.message)
      } else {
        console.debug("[auth] user:", authUser?.id, authUser?.email)
      }

      if (authUser) {
        await loadUserData(authUser)
      } else {
        console.warn("[auth] no authenticated user found")
      }

      console.debug("[auth] init complete, loading → false")
      setLoading(false)
    }

    const AUTH_TIMEOUT_MS = 8000
    Promise.race([
      initSession(),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          setLoading((prev) => {
            if (prev) console.warn("[auth] init timed out after %dms — forcing loading → false", AUTH_TIMEOUT_MS)
            return false
          })
          resolve()
        }, AUTH_TIMEOUT_MS)
      ),
    ])

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
