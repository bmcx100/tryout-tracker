# Tryout Progression Columns — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-level tryout progression columns (Sessions + Result for AA/A/BB/B/C) to the All Players tab and Admin Players page, with an always-visible Status/Team column and a toggle to show/hide the per-level detail columns.

**Architecture:** A shared `lib/progression.ts` module builds a progression map from sessions, session_players, rounds, and round_results data. Both the Players page and Admin Players page import this module. CSS classes in `globals.css` handle color-coding and layout. The table becomes horizontally scrollable when expanded.

**Tech Stack:** Next.js 16, React 19, Supabase (client-side queries), TypeScript, Tailwind v4 + @apply CSS classes

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/progression.ts` | Create | Shared logic: `buildProgressionMap()` and `getOverallStatus()` |
| `app/(app)/players/page.tsx` | Modify | Fetch extra data, add Status/Team columns, add toggle + per-level columns |
| `app/(app)/admin/players/page.tsx` | Modify | Fetch extra data, add Team column, add toggle + per-level columns |
| `app/globals.css` | Modify | Progression table styles, color classes, toggle button |

---

### Task 1: Create `lib/progression.ts` shared module

**Files:**
- Create: `lib/progression.ts`

- [ ] **Step 1: Create the progression module with types and `buildProgressionMap`**

```typescript
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

const LEVELS: PlayerLevel[] = ["AA", "A", "BB", "B", "C"]

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
    // Check if player has sessions at their current_level
    const playerMap = progressionMap.get(player.number)
    const currentEntry = player.current_level ? playerMap?.get(player.current_level) : null
    if (currentEntry && currentEntry.sessions.length > 0) {
      return { label: `${player.current_level} Tryout`, color: null, rowClass: null }
    }
    // Cut but no sessions at next level yet — missing
    if (player.current_level && levelsWithSessions.has(player.current_level)) {
      return { label: "Missing", color: "prog-missing", rowClass: "prog-row-missing" }
    }
    // Sessions don't exist at the next level yet — just show the level
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
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit lib/progression.ts 2>&1 | head -20`

If there are import resolution issues, run the full project check instead:

Run: `npx tsc --noEmit 2>&1 | grep progression`

Expected: No errors related to progression.ts

- [ ] **Step 3: Commit**

```bash
git add lib/progression.ts
git commit -m "feat: add shared progression map module for tryout tracking"
```

---

### Task 2: Add CSS styles for progression columns

**Files:**
- Modify: `app/globals.css` (append after the existing `.status-withdrawn` block around line ~1710)

- [ ] **Step 1: Add progression CSS classes to globals.css**

Append this block after the existing status badge styles (after `.status-withdrawn`):

```css
/* ========================================
   PROGRESSION TABLE
   ======================================== */

.prog-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.prog-toggle {
  @apply font-data font-semibold;
  font-size: 11px;
  color: var(--color-steel);
  background: none;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 0.25rem;
  padding: 2px 10px;
  cursor: pointer;
  white-space: nowrap;
}

.prog-toggle:hover {
  background: rgba(17, 17, 17, 0.04);
}

.prog-level-header {
  @apply font-data font-bold text-center;
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-bottom: 2px solid rgba(17, 17, 17, 0.12);
  padding: 4px 6px;
}

.prog-sub-header {
  @apply font-data text-steel text-center;
  font-size: 9px;
  letter-spacing: 0.04em;
  padding: 2px 6px;
  white-space: nowrap;
}

.prog-cell {
  @apply font-data text-center;
  font-size: 11px;
  padding: 4px 6px;
  white-space: nowrap;
}

.prog-sessions {
  color: var(--color-steel);
}

.prog-dash {
  color: var(--color-ash);
}

.prog-active {
  @apply font-bold;
  color: var(--color-ink);
}

.prog-cut {
  @apply font-bold;
  color: #B8860B;
}

.prog-made {
  @apply font-bold;
  color: #228B22;
}

.prog-missing {
  @apply font-bold;
  color: #E63B2E;
}

.prog-withdrawn {
  color: var(--color-steel);
}

.prog-row-placed {
  background: rgba(34, 139, 34, 0.06);
}

.prog-row-missing {
  background: rgba(230, 59, 46, 0.06);
}

.prog-status {
  @apply font-data font-bold;
  font-size: 11px;
  white-space: nowrap;
}

.prog-team {
  @apply font-data;
  font-size: 11px;
  white-space: nowrap;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add progression table CSS classes"
```

---

### Task 3: Add progression columns to All Players tab

**Files:**
- Modify: `app/(app)/players/page.tsx`

This task modifies the All Players tab in the Players page. The Crew and Teams tabs are unchanged.

- [ ] **Step 1: Add imports and state for progression data**

At the top of `app/(app)/players/page.tsx`, update imports:

Replace:
```typescript
import type { Player, CrewMember } from "@/lib/types"
```

With:
```typescript
import type { Player, CrewMember, Session, Round, RoundResult as RoundResultType } from "@/lib/types"
import {
  buildProgressionMap,
  getOverallStatus,
  getLevelsWithSessions,
  type ProgressionMap,
} from "@/lib/progression"
```

Inside the `PlayersPage` component, after the existing state declarations (after line 41: `const [addOpen, setAddOpen] = useState(false)`), add:

```typescript
const [sessions, setSessions] = useState<Session[]>([])
const [sessionPlayers, setSessionPlayers] = useState<{ session_id: string; player_number: number }[]>([])
const [rounds, setRounds] = useState<Round[]>([])
const [roundResults, setRoundResults] = useState<{ round_id: string; player_number: number; result: RoundResultType }[]>([])
const [showLevelDetails, setShowLevelDetails] = useState(false)
```

- [ ] **Step 2: Update `fetchData` to load progression data**

Replace the existing `fetchData` function with:

```typescript
const fetchData = async () => {
  if (!activeOrgId) return
  const supabase = createClient()
  const [
    { data: playerData },
    { data: crewData },
    { data: sessionData },
    { data: spData },
    { data: roundData },
    { data: rrData },
  ] = await Promise.all([
    supabase.from("players_view").select("*").eq("org_id", activeOrgId).order("number"),
    supabase.from("user_crew").select("*, player:players(*)").eq("org_id", activeOrgId).order("tag"),
    supabase.from("sessions").select("id, level, round_number, group_number, date").eq("org_id", activeOrgId),
    supabase.from("session_players").select("session_id, player_number").eq("org_id", activeOrgId),
    supabase.from("rounds").select("id, level, round_number").eq("org_id", activeOrgId),
    supabase.from("round_results").select("round_id, player_number, result").eq("org_id", activeOrgId),
  ])
  if (playerData) setPlayers(playerData)
  if (crewData) setCrew(crewData)
  if (sessionData) setSessions(sessionData as Session[])
  if (spData) setSessionPlayers(spData)
  if (roundData) setRounds(roundData as Round[])
  if (rrData) setRoundResults(rrData as { round_id: string; player_number: number; result: RoundResultType }[])
  setLoading(false)
}
```

- [ ] **Step 3: Add computed progression data**

After the existing `filtered` computation (after line ~114), add:

```typescript
const progressionMap: ProgressionMap = buildProgressionMap(
  players, sessions, sessionPlayers, rounds, roundResults
)
const levelsWithSessions = getLevelsWithSessions(sessions)
```

- [ ] **Step 4: Replace the All Players tab rendering**

Replace the entire `{tab === "all" && (...)}` block (lines 279–358) with the following. This keeps the same filters at the top but replaces the player list with a table that has Status, Team, and toggleable level detail columns:

```tsx
{tab === "all" && (
  <div className="players-tab-content">
    <div className="feed-filters">
      <button
        className={`feed-filter-btn${ageFilter === "all" ? " active" : ""}`}
        onClick={() => setAgeFilter("all")}
      >
        All
      </button>
      <button
        className={`feed-filter-btn${ageFilter === "U13" ? " active" : ""}`}
        onClick={() => setAgeFilter("U13")}
      >
        U13
      </button>
      <button
        className={`feed-filter-btn${ageFilter === "U15" ? " active" : ""}`}
        onClick={() => setAgeFilter("U15")}
      >
        U15
      </button>
    </div>

    <div className="feed-filters">
      <button
        className={`feed-filter-btn${levelFilter === "all" ? " active" : ""}`}
        onClick={() => setLevelFilter("all")}
      >
        All
      </button>
      {LEVELS.map((l) => (
        <button
          key={l}
          className={`feed-filter-btn${levelFilter === l ? " active" : ""}`}
          onClick={() => setLevelFilter(l)}
        >
          {l}
        </button>
      ))}
    </div>

    <div className="explore-search">
      <Input
        placeholder="Search by number or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    {loading ? null : filtered.length === 0 ? (
      <div className="app-empty-state">
        <p className="app-empty-title">No players found</p>
        <p className="app-empty-desc">
          {players.length === 0
            ? "The admin will add them soon."
            : "Try a different search or filter."}
        </p>
      </div>
    ) : (
      <div className="prog-table-wrap">
        <table className="prog-table">
          <thead>
            <tr>
              <th className="prog-sub-header">#</th>
              <th className="prog-sub-header" style={{ textAlign: "left" }}>Name</th>
              <th className="prog-sub-header">Pos</th>
              <th className="prog-sub-header">Prev Team</th>
              <th className="prog-sub-header">Status</th>
              <th className="prog-sub-header">Team</th>
              {showLevelDetails && LEVELS.map((l) => (
                <th key={l} className="prog-level-header" colSpan={2}>{l}</th>
              ))}
              <th className="prog-sub-header">
                <button
                  className="prog-toggle"
                  onClick={() => setShowLevelDetails(!showLevelDetails)}
                >
                  {showLevelDetails ? "Hide" : "Details"}
                </button>
              </th>
            </tr>
            {showLevelDetails && (
              <tr>
                <th colSpan={6} />
                {LEVELS.map((l) => (
                  <>
                    <th key={`${l}-s`} className="prog-sub-header">Sessions</th>
                    <th key={`${l}-r`} className="prog-sub-header">Result</th>
                  </>
                ))}
                <th />
              </tr>
            )}
          </thead>
          <tbody>
            {filtered.map((player) => {
              const isInCrew = crewMap.has(player.number)
              const status = getOverallStatus(player, progressionMap, levelsWithSessions)
              const playerProg = progressionMap.get(player.number)
              return (
                <tr key={player.id} className={status.rowClass || ""}>
                  <td className="prog-cell">{player.number}</td>
                  <td className="prog-cell" style={{ textAlign: "left" }}>
                    {playerName(player.first_name, player.last_name)}
                  </td>
                  <td className="prog-cell prog-sessions">{player.position || "—"}</td>
                  <td className="prog-cell prog-sessions">{player.previous_team || "—"}</td>
                  <td className={`prog-cell prog-status${status.color ? ` ${status.color}` : ""}`}>
                    {status.label}
                  </td>
                  <td className="prog-cell prog-team">{player.team_placed || "—"}</td>
                  {showLevelDetails && LEVELS.map((l) => {
                    const entry = playerProg?.get(l as PlayerLevel)
                    return (
                      <>
                        <td key={`${l}-s`} className="prog-cell prog-sessions">
                          {entry?.sessions.length ? entry.sessions.join(", ") : <span className="prog-dash">—</span>}
                        </td>
                        <td key={`${l}-r`} className={`prog-cell${entry?.resultColor ? ` ${entry.resultColor}` : ""}`}>
                          {entry?.result || <span className="prog-dash">—</span>}
                        </td>
                      </>
                    )
                  })}
                  <td className="prog-cell">
                    <button
                      className={`crew-heart${isInCrew ? " active" : ""}`}
                      onClick={isInCrew ? undefined : () => handleAddToCrew(player)}
                    >
                      <Heart className="crew-heart-icon" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify build and dev server**

Run: `npm run build 2>&1 | tail -10`

Expected: Build succeeds without errors.

Start dev server and verify the All Players tab loads at `http://localhost:3000/players`.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/players/page.tsx
git commit -m "feat: add progression columns to All Players tab"
```

---

### Task 4: Add progression columns to Admin Players page

**Files:**
- Modify: `app/(app)/admin/players/page.tsx`

This task adds the same progression columns to the admin view. The admin page uses shadcn `Table` components, but we'll switch the player table body to a native `<table>` wrapped in the same `prog-table-wrap` for consistency with the expanded columns. The existing dialog/form code stays unchanged.

- [ ] **Step 1: Add imports for progression**

At the top of `app/(app)/admin/players/page.tsx`, add after the existing type imports:

```typescript
import type { Session, Round, RoundResult as RoundResultType } from "@/lib/types"
import {
  buildProgressionMap,
  getOverallStatus,
  getLevelsWithSessions,
  type ProgressionMap,
} from "@/lib/progression"
```

- [ ] **Step 2: Add state for progression data**

After the existing state declarations (after `const { activeOrgId } = useAuth()` around line 65), add:

```typescript
const [sessions, setSessions] = useState<Session[]>([])
const [sessionPlayers, setSessionPlayers] = useState<{ session_id: string; player_number: number }[]>([])
const [rounds, setRounds] = useState<Round[]>([])
const [roundResults, setRoundResults] = useState<{ round_id: string; player_number: number; result: RoundResultType }[]>([])
const [showLevelDetails, setShowLevelDetails] = useState(false)
```

- [ ] **Step 3: Update `fetchPlayers` and the `useEffect` load**

Replace the existing `fetchPlayers` function with:

```typescript
const fetchPlayers = async () => {
  if (!activeOrgId) return
  const [
    { data: playerData },
    { data: sessionData },
    { data: spData },
    { data: roundData },
    { data: rrData },
  ] = await Promise.all([
    supabase.from("players").select("*").eq("org_id", activeOrgId).order("number"),
    supabase.from("sessions").select("id, level, round_number, group_number, date").eq("org_id", activeOrgId),
    supabase.from("session_players").select("session_id, player_number").eq("org_id", activeOrgId),
    supabase.from("rounds").select("id, level, round_number").eq("org_id", activeOrgId),
    supabase.from("round_results").select("round_id, player_number, result").eq("org_id", activeOrgId),
  ])
  if (playerData) setPlayers(playerData)
  if (sessionData) setSessions(sessionData as Session[])
  if (spData) setSessionPlayers(spData)
  if (roundData) setRounds(roundData as Round[])
  if (rrData) setRoundResults(rrData as { round_id: string; player_number: number; result: RoundResultType }[])
}
```

Replace the existing `useEffect` load (lines 79–90) with:

```typescript
useEffect(() => {
  if (!activeOrgId) return
  fetchPlayers()
}, [activeOrgId])
```

- [ ] **Step 4: Add computed progression data**

After the existing `filtered` computation (after line ~107), add:

```typescript
const progressionMap: ProgressionMap = buildProgressionMap(
  players, sessions, sessionPlayers, rounds, roundResults
)
const levelsWithSessions = getLevelsWithSessions(sessions)
```

- [ ] **Step 5: Replace the Table with progression-enabled table**

Replace the `<Table>` block (lines 382–425) with:

```tsx
<div className="prog-table-wrap">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>#</TableHead>
        <TableHead>Name</TableHead>
        <TableHead>Pos</TableHead>
        <TableHead>Prev Team</TableHead>
        <TableHead>Birth Year</TableHead>
        <TableHead>Level</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Team</TableHead>
        {showLevelDetails && LEVELS.map((l) => (
          <TableHead key={l} colSpan={2} className="prog-level-header">{l}</TableHead>
        ))}
        <TableHead>
          <button
            className="prog-toggle"
            onClick={() => setShowLevelDetails(!showLevelDetails)}
          >
            {showLevelDetails ? "Hide" : "Details"}
          </button>
        </TableHead>
      </TableRow>
      {showLevelDetails && (
        <TableRow>
          <TableHead colSpan={8} />
          {LEVELS.map((l) => (
            <>
              <TableHead key={`${l}-s`} className="prog-sub-header">Sessions</TableHead>
              <TableHead key={`${l}-r`} className="prog-sub-header">Result</TableHead>
            </>
          ))}
          <TableHead />
        </TableRow>
      )}
    </TableHeader>
    <TableBody>
      {filtered.map((player) => {
        const status = getOverallStatus(player, progressionMap, levelsWithSessions)
        const playerProg = progressionMap.get(player.number)
        return (
          <TableRow key={player.id} className={status.rowClass || ""}>
            <TableCell className="admin-cell-number">{player.number}</TableCell>
            <TableCell>{playerName(player.first_name, player.last_name)}</TableCell>
            <TableCell>{player.position || "—"}</TableCell>
            <TableCell>{player.previous_team || "—"}</TableCell>
            <TableCell>{player.birth_year || "—"}</TableCell>
            <TableCell>
              <span className="level-badge">{player.current_level || "—"}</span>
            </TableCell>
            <TableCell>
              <span className={`prog-status${status.color ? ` ${status.color}` : ""}`}>
                {status.label}
              </span>
            </TableCell>
            <TableCell className="prog-team">{player.team_placed || "—"}</TableCell>
            {showLevelDetails && LEVELS.map((l) => {
              const entry = playerProg?.get(l as PlayerLevel)
              return (
                <>
                  <TableCell key={`${l}-s`} className="prog-cell prog-sessions">
                    {entry?.sessions.length ? entry.sessions.join(", ") : <span className="prog-dash">—</span>}
                  </TableCell>
                  <TableCell key={`${l}-r`} className={`prog-cell${entry?.resultColor ? ` ${entry.resultColor}` : ""}`}>
                    {entry?.result || <span className="prog-dash">—</span>}
                  </TableCell>
                </>
              )
            })}
            <TableCell>
              <div className="admin-actions">
                <button className="admin-action-btn" onClick={() => openEdit(player)}>Edit</button>
                <button className="admin-action-btn admin-action-danger" onClick={() => handleDelete(player.id)}>Delete</button>
              </div>
            </TableCell>
          </TableRow>
        )
      })}
      {filtered.length === 0 && (
        <TableRow>
          <TableCell colSpan={showLevelDetails ? 19 : 9} className="admin-empty-cell">No players found</TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
</div>
```

- [ ] **Step 6: Verify build and dev server**

Run: `npm run build 2>&1 | tail -10`

Expected: Build succeeds without errors.

Start dev server and verify at `http://localhost:3000/admin/players`:
- Status column shows derived status (e.g. "AA Tryout", "Placed")
- Team column shows team_placed or dash
- "Details" toggle shows/hides the 10 per-level columns
- Horizontal scroll works when expanded
- Color coding matches spec (gold for cuts, green for placed, red for missing)

- [ ] **Step 7: Commit**

```bash
git add app/(app)/admin/players/page.tsx
git commit -m "feat: add progression columns to Admin Players page"
```

---

### Task 5: Add `prog-table` base styles for the players page native table

**Files:**
- Modify: `app/globals.css`

The Players page (non-admin) uses a native `<table>` element, so we need base styles for it.

- [ ] **Step 1: Add prog-table styles to globals.css**

Add these styles in the progression section (after the previously added progression classes):

```css
.prog-table {
  @apply w-full;
  border-collapse: collapse;
}

.prog-table th,
.prog-table td {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(17, 17, 17, 0.06);
}

.prog-table th {
  @apply font-data text-steel;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.prog-table tbody tr:hover {
  background: rgba(17, 17, 17, 0.02);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build 2>&1 | tail -5`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add prog-table base styles for native table"
```

---

### Task 6: Manual testing and final verification

- [ ] **Step 1: Test All Players tab with progression data**

Start dev server: `npm run dev`

Navigate to `http://localhost:3000/players` and switch to the All Players tab.

Verify:
- Status column shows (e.g. "AA Tryout", "Placed", "Missing", "Withdrawn")
- Team column shows team_placed or dash
- "Details" button appears in header
- Clicking "Details" expands 10 columns (Sessions + Result for each of AA, A, BB, B, C)
- Session cells show "R1G2, R2G1" format
- Result cells show "Active", "1st Cut", "Made Team", etc. with correct colors
- Missing players show red text
- Placed players show green text with light green row background
- Table scrolls horizontally when expanded
- Heart button still works to add to crew
- Filters (age, level, search) still work
- Clicking "Hide" collapses the level columns

- [ ] **Step 2: Test Admin Players page**

Navigate to `http://localhost:3000/admin/players`.

Verify:
- Same progression columns appear
- Admin-specific columns (Birth Year, Level) still show
- Edit and Delete buttons still work
- Status shows derived label instead of raw status
- Team column shows team_placed
- Toggle works

- [ ] **Step 3: Test edge cases**

- Player with no entry_level → Status shows "Unknown"
- Player with no sessions at any level → All level columns show dashes
- Newly added player → Shows correctly after re-fetch
- No sessions in the org → All columns show dashes, Status shows entry_level + "Tryout"

- [ ] **Step 4: Run lint**

Run: `npm run lint 2>&1 | tail -20`

Fix any lint errors.

- [ ] **Step 5: Final commit (if lint fixes needed)**

```bash
git add -A
git commit -m "fix: lint fixes for progression columns"
```
