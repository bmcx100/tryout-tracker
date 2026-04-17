import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: getClaims() validates the JWT locally (no network call).
  // Using getUser() here caused intermittent auth failures because it makes
  // a network request to Supabase Auth on every middleware invocation.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  const userId = (claims?.sub as string) ?? null

  const pathname = request.nextUrl.pathname

  const publicRoutes = ["/", "/login", "/pending", "/auth/callback"]
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/auth/") || pathname.startsWith("/track/")
  )

  if (userId && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    return NextResponse.redirect(url)
  }

  if (!userId && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (userId && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_org_id, is_super_admin")
      .eq("id", userId)
      .single()

    if (!profile || !profile.active_org_id) {
      const url = request.nextUrl.clone()
      url.pathname = "/pending"
      return NextResponse.redirect(url)
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", profile.active_org_id)
      .eq("user_id", userId)
      .single()

    if (!membership || membership.role === "pending") {
      const url = request.nextUrl.clone()
      url.pathname = "/pending"
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith("/admin") && membership.role !== "admin" && !profile.is_super_admin) {
      const url = request.nextUrl.clone()
      url.pathname = "/home"
      return NextResponse.redirect(url)
    }
  }

  supabaseResponse.headers.set("Cache-Control", "private, no-store")

  return supabaseResponse
}
