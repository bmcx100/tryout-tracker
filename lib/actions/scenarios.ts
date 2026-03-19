"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import type { ScenarioDataPayload } from "@/lib/types"

export async function listScenarios() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // RLS handles returning own + shared scenarios
  const { data, error } = await supabase
    .from("user_scenarios")
    .select("id, name, user_id, is_shared, updated_at")
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []).map((s) => ({
    ...s,
    isOwn: s.user_id === user.id,
  }))
}

export async function loadScenario(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_scenarios")
    .select("*")
    .eq("id", id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function saveScenario(input: {
  name: string
  description?: string
  scenario_data: ScenarioDataPayload
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const row: Record<string, unknown> = {
    user_id: user.id,
    name: input.name,
    scenario_data: input.scenario_data,
  }
  if (input.description) row.description = input.description

  const { error } = await supabase.from("user_scenarios").insert(row)

  if (error) throw new Error(error.message)
  revalidatePath("/current")
}

export async function updateScenario(
  id: string,
  input: {
    name?: string
    description?: string | null
    scenario_data?: ScenarioDataPayload
  },
) {
  const supabase = await createClient()

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.name !== undefined) payload.name = input.name
  if (input.scenario_data !== undefined) payload.scenario_data = input.scenario_data
  if (input.description !== undefined) payload.description = input.description

  const { error } = await supabase
    .from("user_scenarios")
    .update(payload)
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/current")
}

export async function toggleSharedScenario(id: string, isShared: boolean) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_scenarios")
    .update({ is_shared: isShared, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/current")
}

export async function deleteScenario(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_scenarios")
    .delete()
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/current")
}
