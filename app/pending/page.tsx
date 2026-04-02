"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function PendingPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("membership-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "org_members",
        },
        async (payload) => {
          if (payload.new.role !== "pending") {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase
                .from("profiles")
                .update({ active_org_id: payload.new.org_id })
                .eq("id", user.id)
            }
            router.push("/home")
          }
        }
      )
      .subscribe()

    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships } = await supabase
        .from("org_members")
        .select("role, org_id")
        .eq("user_id", user.id)
        .neq("role", "pending")

      if (memberships && memberships.length > 0) {
        await supabase
          .from("profiles")
          .update({ active_org_id: memberships[0].org_id })
          .eq("id", user.id)
        router.push("/home")
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
        <div className="pending-brand">TRYOUT TRACKER</div>
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
