# Tryout Progression Columns

## Summary

Add per-level tryout progression columns to the All Players tab and Admin Players page. Each level (AA, A, BB, B, C) gets two sub-columns: Sessions (which round+group they skated in) and Result (Active, Nth Cut, Made Team). An overall Status column and Team column are always visible. The per-level detail columns are collapsible (hidden by default).

## Where It Appears

- **All Players tab** (`app/(app)/players/page.tsx`) — for all users
- **Admin Players page** (`app/(app)/admin/players/page.tsx`) — admin view

NOT on the Teams tab.

## Column Layout

### Always visible (collapsed default)

| # | Name | Pos | Prev Team | Status | Team | [Toggle] |

- **Status**: Overall current status derived from `player.status` + `current_level`
  - `active_tryout` → "{current_level} Tryout" (e.g. "AA Tryout", "A Tryout")
  - `cut_to_next_level` + expected at level with sessions → "Missing" (red)
  - `placed_on_team` → "Placed" (green)
  - `withdrawn` → "Withdrawn"
- **Team**: From `player.team_placed`. Empty dash if not placed.

### Expanded (toggled on)

Adds 10 columns (2 per level): AA Sessions, AA Result, A Sessions, A Result, BB Sessions, BB Result, B Sessions, B Result, C Sessions, C Result.

#### Sessions sub-column

Lists every session the player was assigned to at that level. Format: **R{round}G{group}** (e.g. "R1G2, R2G1, R3G4").

Data source: Join `session_players` → `sessions` where `sessions.level` matches the column's level. Display `R{round_number}G{group_number}` for each, sorted chronologically by session date.

Empty dash if no sessions at that level.

#### Result sub-column

The player's latest outcome at that level. Data source: `round_results` joined with `rounds` (to get round level and round_number).

- **Active** — player has sessions at this level, no terminal result (advanced or no results yet)
- **1st Cut / 2nd Cut / 3rd Cut** — `result = "cut_down"` at this level. The ordinal comes from the round's `round_number` at that level (Round 1 cut = "1st Cut", Round 2 cut = "2nd Cut", etc.)
- **Made Team** — `result = "placed"` at this level (green)
- **Withdrawn** — `result = "withdrawn"` at this level
- **Missing** — player's `entry_level` or `current_level` matches this level AND sessions exist at this level, but the player has no `session_players` entries. Red text.
- Empty dash — player never tried out at this level

## Data Assembly

All needed data is already fetched or can be added to existing queries:

### New data needed on the page

1. **`session_players`** — all session assignments for the org
2. **`sessions`** — all sessions (already partially fetched on some pages, need level + round_number + group_number)
3. **`round_results`** — all round results for the org
4. **`rounds`** — all rounds (need level + round_number)

### Build progression map

For each player, build a `Map<level, { sessions: string[], result: string }>`:

```
progressionMap = Map<playerNumber, Map<level, {
  sessions: string[]      // ["R1G2", "R2G1"]
  result: string | null   // "Active" | "1st Cut" | "Made Team" | etc.
}>>
```

**Steps:**

1. Build `sessionsByLevel`: Map each session to its level. For each session_player entry, record which sessions (R{round}G{group}) the player attended at each level.

2. Build `resultsByLevel`: For each round_result, look up the round's level. Track the latest result per player per level. For cut_down results, record the round_number to derive "Nth Cut".

3. Detect "Missing": For each player where `entry_level` or `current_level` = a level that has sessions, but no session_players entries exist → mark as Missing.

### Compute overall Status

Derived from `player.status` and `player.current_level`:
- `active_tryout` → `"{currentLevel || entryLevel} Tryout"`
- `cut_to_next_level` with no sessions at `current_level` → `"Missing"` (red)
- `cut_to_next_level` with sessions at `current_level` → `"{current_level} Tryout"`
- `placed_on_team` → `"Placed"` (green)
- `withdrawn` → `"Withdrawn"`

## UI Behavior

### Toggle

A single toggle button in the table header: "Show Level Details" / "Hide". Clicking expands or collapses all 10 per-level columns. State stored in component local state (not persisted).

### Horizontal scroll

When expanded, the table will be wide. The table container gets `overflow-x: auto`. The #, Name, Status, and Team columns should remain readable — consider sticky left columns if feasible, otherwise accept horizontal scroll.

### Color coding

- **Active**: default text color, bold
- **1st/2nd/3rd Cut**: dark gold (#B8860B), bold
- **Made Team**: green (#228B22), bold
- **Placed** (overall): green (#228B22), bold, light green row background
- **Missing**: signal red (#E63B2E), bold, light red row background
- **Withdrawn**: steel gray
- Empty levels: light gray dash

## Components Changed

### `app/(app)/players/page.tsx`
- Add Status and Team columns to All Players tab (always visible)
- Fetch `session_players`, `sessions`, `rounds`, `round_results` data
- Build progression map
- Add toggle state for level detail columns
- Render per-level columns when expanded

### `app/(app)/admin/players/page.tsx`
- Add the same progression columns (Sessions + Result per level)
- Status column already exists — add Team column
- Add toggle for level detail columns
- Fetch additional data (session_players, sessions, round_results, rounds)

### `app/globals.css`
- Progression table styles
- Level column header styling (grouped headers with sub-headers)
- Result color classes (active, cut, placed, missing, withdrawn)
- Toggle button styling

### New shared module: `lib/progression.ts`
- `buildProgressionMap(players, sessions, sessionPlayers, rounds, roundResults)` — returns the progression map
- `getOverallStatus(player, progressionMap, sessionLevels)` — returns status label + color
- Shared between Players page and Admin Players page

## Edge Cases

- **No sessions exist yet**: Level detail columns are all empty dashes. Status shows entry_level + "Tryout".
- **Player with no entry_level**: Skip progression (can't determine expected path). Status shows "Unknown".
- **Multiple cuts at same level**: Shouldn't happen in normal flow (a player is cut once from a level). If it does, use the latest round_result.
- **Player advanced but not yet assigned to next session**: Shows "Active" at current level with sessions listed. No "Missing" flag until sessions exist at the next level.
- **Lite users**: Names hidden per players_view RLS. Progression data is still shown (it's not name-sensitive).

## Out of Scope

- Persisting the expanded/collapsed toggle state
- Filtering by progression status (e.g. "show me all 1st cuts")
- Crew tab progression display
- Teams tab progression display
- Editable progression data (admin records results via Rounds page)
