import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // If there's a next URL (e.g., from /join flow), redirect there
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }

      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("active_org_id")
          .eq("id", user.id)
          .single()

        if (!profile?.active_org_id) {
          return NextResponse.redirect(`${origin}/pending`)
        }

        return NextResponse.redirect(`${origin}/home`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
