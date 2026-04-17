import type { Player, PlayerLevel, Session, Round, RoundResult } from "@/lib/types"

export type LevelProgression = {
  sessions: string[]
  result: string | null
  resultColor: string | null
}

export type ProgressionMap = Map<number, Map<PlayerLevel, LevelProgression>>

export type OverallStatus = {
  label: string
  color: string | null
  rowClass: string | null
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"]

export function buildProgressionMap(
  players: Player[],
  sessions: Session[],
  sessionPlayers: { session_id: string; player_number: number }[],
  rounds: Round[],
  roundResults: { round_id: string; player_number: number; result: RoundResult }[]
): ProgressionMap {
  const map: ProgressionMap = new Map()

  // Index sessions by id for quick lookup
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  // Index rounds by id for quick lookup
  const roundById = new Map(rounds.map((r) => [r.id, r]))

  // Track which levels have any sessions (for "Missing" detection)
  const levelsWithSessions = new Set<PlayerLevel>()
  for (const s of sessions) {
    levelsWithSessions.add(s.level)
  }

  // Step 1: Build sessions per player per level
  for (const sp of sessionPlayers) {
    const session = sessionById.get(sp.session_id)
    if (!session) continue

    if (!map.has(sp.player_number)) {
      map.set(sp.player_number, new Map())
    }
    const playerMap = map.get(sp.player_number)!
    if (!playerMap.has(session.level)) {
      playerMap.set(session.level, { sessions: [], result: null, resultColor: null })
    }
    const entry = playerMap.get(session.level)!
    entry.sessions.push(`R${session.round_number}G${session.group_number}`)
  }

  // Sort sessions within each level by round then group
  for (const playerMap of map.values()) {
    for (const entry of playerMap.values()) {
      entry.sessions.sort((a, b) => {
        const parseRG = (s: string) => {
          const m = s.match(/R(\d+)G(\d+)/)
          return m ? [parseInt(m[1]), parseInt(m[2])] : [0, 0]
        }
        const [ar, ag] = parseRG(a)
        const [br, bg] = parseRG(b)
        return ar !== br ? ar - br : ag - bg
      })
    }
  }

  // Step 2: Build results per player per level
  for (const rr of roundResults) {
    const round = roundById.get(rr.round_id)
    if (!round) continue

    const level = round.level as PlayerLevel

    if (!map.has(rr.player_number)) {
      map.set(rr.player_number, new Map())
    }
    const playerMap = map.get(rr.player_number)!
    if (!playerMap.has(level)) {
      playerMap.set(level, { sessions: [], result: null, resultColor: null })
    }
    const entry = playerMap.get(level)!

    if (rr.result === "cut_down") {
      const ordinal = ORDINALS[round.round_number - 1] || `${round.round_number}th`
      entry.result = `${ordinal} Cut`
      entry.resultColor = "prog-cut"
    } else if (rr.result === "placed") {
      entry.result = "Made Team"
      entry.resultColor = "prog-made"
    } else if (rr.result === "withdrawn") {
      entry.result = "Withdrawn"
      entry.resultColor = "prog-withdrawn"
    }
    // "advanced" means still active — don't overwrite a terminal result
  }

  // Step 3: Mark "Active" for players with sessions but no terminal result
  for (const playerMap of map.values()) {
    for (const entry of playerMap.values()) {
      if (entry.sessions.length > 0 && !entry.result) {
        entry.result = "Active"
        entry.resultColor = "prog-active"
      }
    }
  }

  // Step 4: Detect "Missing" — player expected at level but has no sessions
  for (const player of players) {
    const expectedLevels: PlayerLevel[] = []
    if (player.entry_level) expectedLevels.push(player.entry_level)
    if (player.current_level && player.current_level !== player.entry_level) {
      expectedLevels.push(player.current_level)
    }

    for (const level of expectedLevels) {
      if (!levelsWithSessions.has(level)) continue

      if (!map.has(player.number)) {
        map.set(player.number, new Map())
      }
      const playerMap = map.get(player.number)!
      const entry = playerMap.get(level)

      if (!entry || entry.sessions.length === 0) {
        if (!entry) {
          playerMap.set(level, { sessions: [], result: "Missing", resultColor: "prog-missing" })
        } else if (!entry.result) {
          entry.result = "Missing"
          entry.resultColor = "prog-missing"
        }
      }
    }
  }

  return map
}

export function getOverallStatus(
  player: Player,
  progressionMap: ProgressionMap,
  levelsWithSessions: Set<PlayerLevel>
): OverallStatus {
  if (player.status === "placed_on_team") {
    return { label: "Placed", color: "prog-made", rowClass: "prog-row-placed" }
  }

  if (player.status === "withdrawn") {
    return { label: "Withdrawn", color: "prog-withdrawn", rowClass: null }
  }

  const displayLevel = player.current_level || player.entry_level

  if (player.status === "cut_to_next_level") {
    const playerMap = progressionMap.get(player.number)
    const currentEntry = player.current_level ? playerMap?.get(player.current_level) : null
    if (currentEntry && currentEntry.sessions.length > 0) {
      return { label: `${player.current_level} Tryout`, color: null, rowClass: null }
    }
    if (player.current_level && levelsWithSessions.has(player.current_level)) {
      return { label: "Missing", color: "prog-missing", rowClass: "prog-row-missing" }
    }
    return { label: displayLevel ? `${displayLevel} Tryout` : "Unknown", color: null, rowClass: null }
  }

  if (player.status === "active_tryout") {
    return {
      label: displayLevel ? `${displayLevel} Tryout` : "Unknown",
      color: null,
      rowClass: null,
    }
  }

  return { label: "Unknown", color: null, rowClass: null }
}

export function getLevelsWithSessions(sessions: Session[]): Set<PlayerLevel> {
  const levels = new Set<PlayerLevel>()
  for (const s of sessions) {
    levels.add(s.level)
  }
  return levels
}
