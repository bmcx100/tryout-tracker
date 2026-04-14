"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { Profile, Organization } from "@/lib/types"
import { logAuthError } from "@/lib/auth-error-logger"

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
        if (!profileData) {
          logAuthError("fetchProfile", "profile null after retry", undefined, {
            userId: authUser.id,
            email: authUser.email ?? undefined,
          })
        }
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
      // Step 1: Try getSession() with a 3s timeout
      // getSession() is usually instant (local read), but if the JWT is expired
      // it triggers a token refresh network call that can hang on production
      const SESSION_TIMEOUT_MS = 3000
      let session = null
      let sessionError = null

      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("getSession timed out")), SESSION_TIMEOUT_MS)
          ),
        ])
        session = result.data.session
        sessionError = result.error
      } catch (err) {
        console.warn("[auth] getSession timed out after %dms — skipping to getUser()", SESSION_TIMEOUT_MS)
        logAuthError("getSession:timeout", `getSession hung for ${SESSION_TIMEOUT_MS}ms`)
      }

      if (sessionError) {
        console.error("[auth] getSession error:", sessionError.message)
        logAuthError("getSession", sessionError.message)
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
            logAuthError("getUser:background", verifyError?.message ?? "no verified user returned", undefined, {
              userId: session.user.id,
              email: session.user.email ?? undefined,
            })
            // Token was invalid, clear state and redirect
            setUser(null)
            setProfile(null)
            setUserOrgs([])
            router.push("/login")
          }
        })
        return
      }

      // No local session (or getSession timed out) — fall back to getUser()
      const GETUSER_TIMEOUT_MS = 3000
      console.debug("[auth] no local session, falling back to getUser()")
      let authUser = null
      let authError = null

      try {
        const result = await Promise.race([
          supabase.auth.getUser(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("getUser timed out")), GETUSER_TIMEOUT_MS)
          ),
        ])
        authUser = result.data.user
        authError = result.error
      } catch {
        console.warn("[auth] getUser timed out after %dms — trying direct query", GETUSER_TIMEOUT_MS)
        logAuthError("getUser:timeout", `getUser hung for ${GETUSER_TIMEOUT_MS}ms`)
      }

      if (authError) {
        console.error("[auth] getUser error:", authError.message)
        logAuthError("getUser:fallback", authError.message)
      }

      if (authUser) {
        console.debug("[auth] user:", authUser.id, authUser.email)
        await loadUserData(authUser)
        console.debug("[auth] init complete via getUser, loading → false")
        setLoading(false)
        return
      }

      // Step 3: Both auth SDK calls failed — bypass SDK entirely
      // PostgREST reads the JWT from cookies independently of the auth module
      console.debug("[auth] auth SDK unresponsive, trying direct profile query")
      try {
        const { data: directProfile, error: dbError } = await supabase
          .from("profiles")
          .select("*")
          .limit(1)
          .maybeSingle()

        if (directProfile) {
          console.debug("[auth] recovered via direct profile query:", directProfile.id, directProfile.email)
          logAuthError("auth-sdk-bypass", "recovered via direct profile query", undefined, {
            userId: directProfile.id,
            email: directProfile.email,
          })
          hadUser.current = true
          setUser({ id: directProfile.id, email: directProfile.email, user_metadata: {} } as User)
          setProfile(directProfile)

          const { data: orgsData } = await supabase
            .from("org_members")
            .select("org_id, role, organizations(id, name, slug)")
            .eq("user_id", directProfile.id)
            .neq("role", "pending")
          setUserOrgs((orgsData as unknown as UserOrg[]) || [])
        } else {
          console.warn("[auth] direct profile query returned null:", dbError?.message)
          logAuthError("all-methods-failed", dbError?.message ?? "no session found")
        }
      } catch (err) {
        console.error("[auth] direct profile query error:", err)
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
            if (prev) {
              console.warn("[auth] init timed out after %dms — forcing loading → false", AUTH_TIMEOUT_MS)
              logAuthError("timeout", `auth init timed out after ${AUTH_TIMEOUT_MS}ms`)
            }
            return false
          })
          resolve()
        }, AUTH_TIMEOUT_MS)
      ),
    ])

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // INITIAL_SESSION with no user = normal unauthenticated load, let initSession handle it
        if (event === "INITIAL_SESSION" && !session?.user) return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          hadUser.current = true
          // Always fetch profile/orgs — not just SIGNED_IN
          // On slow Supabase, INITIAL_SESSION or TOKEN_REFRESHED fires
          // after our manual init times out, and this is the recovery path
          await fetchProfile(currentUser.id)
          await fetchOrgs(currentUser.id)
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
