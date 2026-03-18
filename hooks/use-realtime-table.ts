"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export function useRealtimeTable(
  table: string,
  onChange: () => void,
  filter?: string
) {
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`realtime-${table}-${filter || "all"}`)
      .on(
        "postgres_changes" as never,
        {
          event: "*",
          schema: "public",
          table,
          ...(filter ? { filter } : {}),
        } as never,
        onChange as never
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter, onChange])
}
