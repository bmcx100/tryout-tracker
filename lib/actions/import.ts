"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function confirmImport(players: Array<{ number: number; first_name?: string; last_name?: string }>) {
  const supabase = await createClient()

  for (const player of players) {
    const { error } = await supabase.from("players").upsert(
      {
        number: player.number,
        first_name: player.first_name || null,
        last_name: player.last_name || null,
        status: "active_tryout",
      },
      { onConflict: "number" }
    )

    if (error) {
      throw new Error(`Failed to import player #${player.number}: ${error.message}`)
    }
  }

  revalidatePath("/admin/players")
  revalidatePath("/players")
}
