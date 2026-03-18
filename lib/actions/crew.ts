"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { CrewTag } from "@/lib/types"

export async function addToCrew(data: {
  player_number: number
  personal_name: string
  tag: CrewTag
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase.from("user_crew").insert({
    user_id: user.id,
    ...data,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/crew")
  revalidatePath("/home")
  revalidatePath("/current")
  revalidatePath("/players")
  revalidatePath("/teams")
}

export async function updateCrewMember(
  id: string,
  data: {
    personal_name?: string
    tag?: CrewTag
    notes?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("user_crew")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/crew")
}

export async function removeFromCrew(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("user_crew").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/crew")
  revalidatePath("/home")
  revalidatePath("/current")
  revalidatePath("/players")
  revalidatePath("/teams")
}
