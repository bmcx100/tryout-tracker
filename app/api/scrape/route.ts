import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseHtml, parseContinuationsHtml } from "@/lib/scraper/parser"

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
    const { url, type, level } = await request.json()

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

    if (type === "continuations") {
      const result = parseContinuationsHtml(html)

      const playerNames: Record<string, string> = {}
      if (result.all_continuing_numbers.length > 0 && profile?.active_org_id) {
        const { data: players } = await supabase
          .from("players")
          .select("number, first_name, last_name")
          .eq("org_id", profile.active_org_id)
          .in("number", result.all_continuing_numbers)

        for (const p of players || []) {
          const parts = [p.first_name, p.last_name].filter(Boolean)
          if (parts.length > 0) {
            playerNames[String(p.number)] = parts.join(" ")
          }
        }
      }

      let missingPlayers: Array<{ number: number; name: string; entry_level: string }> = []
      if (level && profile?.active_org_id) {
        const { data: cutPlayers } = await supabase
          .from("players")
          .select("number, first_name, last_name, entry_level")
          .eq("org_id", profile.active_org_id)
          .eq("current_level", level)
          .eq("status", "cut_to_next_level")

        missingPlayers = (cutPlayers || [])
          .filter(p => !result.all_continuing_numbers.includes(p.number))
          .map(p => ({
            number: p.number,
            name: [p.first_name, p.last_name].filter(Boolean).join(" "),
            entry_level: p.entry_level || "higher level",
          }))
      }

      let suggested_round = 1
      if (level && profile?.active_org_id) {
        const { data: existingSessions } = await supabase
          .from("sessions")
          .select("round_number")
          .eq("org_id", profile.active_org_id)
          .eq("level", level)
          .order("round_number", { ascending: false })
          .limit(1)

        if (existingSessions && existingSessions.length > 0) {
          suggested_round = existingSessions[0].round_number + 1
        }
      }

      return NextResponse.json({
        ...result,
        playerNames,
        missingPlayers,
        suggested_round,
      })
    }

    const result = parseHtml(html)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scrape failed" },
      { status: 500 }
    )
  }
}
