import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type AgeGroup = "U13" | "U15"

export const AGE_GROUPS: AgeGroup[] = ["U13", "U15"]

export const PREVIOUS_TEAMS: Record<AgeGroup, string[]> = {
  U13: ["U13AA", "U13A", "U13BB", "U13B", "U13C"],
  U15: ["U15AA", "U15A", "U15BB", "U15B", "U15C"],
}

export function getAgeGroup(birthYear: number | null): AgeGroup | null {
  if (!birthYear) return null
  if (birthYear >= 2013) return "U13"
  if (birthYear >= 2011) return "U15"
  return null
}

export type PlayerLevel = "AA" | "A" | "BB" | "B" | "C"

export const LEVEL_ORDER: PlayerLevel[] = ["AA", "A", "BB", "B", "C"]

// Default competition landscape sort: age-first (U15 above U13), then level within age
export const DEFAULT_TEAM_ORDER: string[] = [
  "U15AA", "U15A", "U15BB", "U15B", "U15C",
  "U13AA", "U13A", "U13BB", "U13B", "U13C",
]

export type Position = "ALL" | "F" | "D" | "G"

export const POSITIONS: { value: Position; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "F", label: "Forward" },
  { value: "D", label: "Defense" },
  { value: "G", label: "Goalie" },
]

function isKnown(val: string | null | undefined): string | null {
  if (!val) return null
  if (val.toLowerCase() === "unknown") return null
  return val
}

export function playerName(firstName: string | null | undefined, lastName: string | null | undefined, number?: number): string {
  return [isKnown(firstName), isKnown(lastName)].filter(Boolean).join(" ") || (number != null ? `#${number}` : "—")
}

export function extractLevelFromTeam(team: string | null): PlayerLevel | null {
  if (!team) return null
  const match = team.match(/^U\d+(AA|BB|A|B|C)$/i)
  return match ? match[1].toUpperCase() as PlayerLevel : null
}
