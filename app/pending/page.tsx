"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function PendingPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("profile-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          if (payload.new.role !== "pending") {
            router.push("/crew")
          }
        }
      )
      .subscribe()

    // Polling fallback — check every 10s
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile && profile.role !== "pending") {
        router.push("/crew")
      }
    }, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className="pending-brand">CABOT</div>
        <h1 className="pending-headline">Almost there</h1>
        <p className="pending-body">
          An admin needs to let you in. Once approved, you can start
          tracking your crew.
        </p>
        <div className="pending-status">
          <div className="pending-dot" />
          <span className="pending-status-text">Waiting for approval</span>
        </div>
        <button className="pending-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
