"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { joinOrganization } from "@/lib/actions/join"
import { Button } from "@/components/ui/button"

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [orgName, setOrgName] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "approved" | "error">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    if (status === "approved") {
      const timer = setTimeout(() => router.push("/home"), 2000)
      return () => clearTimeout(timer)
    }
  }, [status, router])

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
      const returnUrl = `/track/${slug}`
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`,
        },
      })
      return
    }

    try {
      const result = await joinOrganization(slug)

      if (result.error) {
        setError(result.error)
        setStatus("error")
        return
      }

      if (result.alreadyMember && result.role !== "pending") {
        router.push("/home")
        return
      }

      if (result.preApproved) {
        setStatus("approved")
        return
      }

      setStatus("done")
    } catch {
      setError("Something went wrong. Please try again.")
      setStatus("error")
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

  if (status === "approved") {
    return (
      <div className="join-page">
        <div className="join-card">
          <h1 className="join-headline">Welcome!</h1>
          <p className="join-body">
            You&apos;ve been pre-approved for {orgName}. Redirecting...
          </p>
          <Button onClick={() => router.push("/home")}>Go to Home</Button>
        </div>
      </div>
    )
  }

  if (status === "joining") {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-spinner" />
          <p className="join-body">Connecting to {orgName}...</p>
        </div>
      </div>
    )
  }

  if (status === "done") {
    return (
      <div className="join-page">
        <div className="join-card">
          <div className="join-success-icon">&#10003;</div>
          <h1 className="join-headline">Request sent!</h1>
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
        <h1 className="join-headline">Track {orgName}</h1>
        <p className="join-body">
          Sign in to start tracking {orgName}&apos;s tryouts.
        </p>
        <Button onClick={handleJoin}>
          Track {orgName}
        </Button>
      </div>
    </div>
  )
}
