export type UserRole = "pending" | "lite" | "full" | "admin"

export type PlayerLevel = "AA" | "A" | "BB" | "B" | "C"

export type PlayerStatus =
  | "active_tryout"
  | "cut_to_next_level"
  | "placed_on_team"
  | "withdrawn"

export type RoundResult = "advanced" | "cut_down" | "withdrawn" | "placed"

export type CrewTag = "bff" | "teammate" | "old_teammate" | "friend"

export type CorrectionStatus = "pending" | "approved" | "rejected"

export type CorrectionEntityType = "player" | "session" | "round"

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  created_at: string
  approved_at: string | null
}

export interface Player {
  id: string
  number: number
  first_name: string | null
  last_name: string | null
  previous_team: string | null
  position: string | null
  birth_year: number | null
  notes: string | null
  previous_level: PlayerLevel | null
  entry_level: PlayerLevel | null
  current_level: PlayerLevel | null
  status: PlayerStatus
  team_placed: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  level: PlayerLevel
  round_number: number
  group_number: number
  date: string
  start_time: string
  end_time: string
  rink: string
  notes: string | null
}

export interface SessionPlayer {
  session_id: string
  player_number: number
}

export interface Round {
  id: string
  level: PlayerLevel
  round_number: number
  date: string
  notes: string | null
}

export interface RoundResultRecord {
  id: string
  round_id: string
  player_number: number
  result: RoundResult
  notes: string | null
}

export interface CrewMember {
  id: string
  user_id: string
  player_number: number
  personal_name: string
  tag: CrewTag
  notes: string | null
  created_at: string
  updated_at: string
  player?: Player
}

export type ScenarioSource = "returning" | "level_below" | "age_up" | "level_above" | "manual"

export interface ScenarioPlayerData {
  player_number: number
  locked: boolean
  source: ScenarioSource
  bubble: boolean
  priority: number
}

export interface ScenarioTeamData {
  teamName: string
  level: PlayerLevel
  roster: ScenarioPlayerData[]
}

export interface ScenarioDataPayload {
  version: 1
  teams: ScenarioTeamData[]
  unassigned: number[]
  completedTeams: string[]
}

export interface UserScenario {
  id: string
  user_id: string
  name: string
  description: string | null
  scenario_data: ScenarioDataPayload
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface Correction {
  id: string
  user_id: string
  player_number: number | null
  entity_type: CorrectionEntityType
  entity_id: string
  field: string
  current_value: string
  suggested_value: string
  status: CorrectionStatus
  admin_notes: string | null
}
