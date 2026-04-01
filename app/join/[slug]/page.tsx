"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [orgName, setOrgName] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    const supabase = createClient()
    const fetchOrg = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("slug", slug)
        .single()

      if (data) {
        setOrgName(data.name)
        setStatus("ready")
      } else {
        setError("Organization not found")
        setStatus("error")
      }
    }
    fetchOrg()
  }, [slug])

  const handleJoin = async () => {
    setStatus("joining")
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const returnUrl = `/join/${slug}`
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`,
        },
      })
      return
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()

    if (!org) {
      setError("Organization not found")
      setStatus("error")
      return
    }

    const { data: existing } = await supabase
      .from("org_members")
      .select("id, role")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .single()

    if (existing) {
      if (existing.role === "pending") {
        setStatus("done")
      } else {
        router.push("/home")
        return
      }
    } else {
      const { error: insertError } = await supabase
        .from("org_members")
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: "pending",
        })

      if (insertError) {
        setError(insertError.message)
        setStatus("error")
        return
      }

      setStatus("done")
    }
  }

  if (status === "loading") {
    return <div className="join-page"><p>Loading...</p></div>
  }

  if (status === "error") {
    return (
      <div className="join-page">
        <div className="join-card">
          <p className="join-error">{error}</p>
        </div>
      </div>
    )
  }

  if (status === "done") {
    return (
      <div className="join-page">
        <div className="join-card">
          <h1 className="join-headline">Request sent</h1>
          <p className="join-body">
            A {orgName} admin will review your request.
            You&apos;ll get access once approved.
          </p>
          <Button onClick={() => router.push("/pending")}>Continue</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-brand">TRYOUT TRACKER</div>
        <h1 className="join-headline">Join {orgName}</h1>
        <p className="join-body">
          Sign in with Google to request access to {orgName}&apos;s tryout tracker.
        </p>
        <Button onClick={handleJoin} disabled={status === "joining"}>
          {status === "joining" ? "Joining..." : `Join ${orgName}`}
        </Button>
      </div>
    </div>
  )
}
