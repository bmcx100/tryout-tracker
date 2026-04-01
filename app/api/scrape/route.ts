import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseHtml } from "@/lib/scraper/parser"

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin, active_org_id")
    .eq("id", user.id)
    .single()

  if (!profile?.is_super_admin) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", profile?.active_org_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  try {
    const { url } = await request.json()

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TryoutTracker/1.0)",
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 400 }
      )
    }

    const html = await response.text()
    const result = parseHtml(html)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scrape failed" },
      { status: 500 }
    )
  }
}
