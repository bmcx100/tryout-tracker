import { createClient } from "@/lib/supabase/client"

export function logAuthError(
  phase: string,
  errorMessage?: string,
  metadata?: Record<string, unknown>,
  context?: { userId?: string, email?: string }
) {
  try {
    const supabase = createClient()
    supabase.from("auth_errors").insert({
      user_id: context?.userId ?? null,
      email: context?.email ?? null,
      phase,
      error_message: errorMessage ?? null,
      metadata: metadata ?? null,
    }).then(({ error }) => {
      if (error) console.warn("[auth-error-logger] failed to log:", error.message)
    })
  } catch {
    // Never break the app over logging
  }
}
