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

export type PositionGroup = "all" | "forwards" | "defense" | "goalies" | "global"

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: UserRole
  approved_at: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  display_name: string | null
  is_super_admin: boolean
  active_org_id: string | null
  created_at: string
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
  entry_level: PlayerLevel | null
  current_level: PlayerLevel | null
  info_confirmed: boolean
  checked_in: boolean
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

export interface PinnedPlayer {
  team: string
  position: number
}

export interface UserCompetitionPrefs {
  id: string
  user_id: string
  position_group: PositionGroup
  team_order: string[]
  player_order: Record<string, number[]>
  pinned_players: Record<string, PinnedPlayer>
  team_slots: Record<string, Record<string, number>>
  position_overrides: Record<string, string>
  last_viewed: string
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
