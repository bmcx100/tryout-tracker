# Competition Landscape — Home Screen Redesign

## Overview

Replace the current Home page (crew feed + quick links) with a **position-based competition landscape** view. Parents pick a position (Forward, Defense, Goalie) and see every player at that position, organized by previous team in a user-sortable tier list. Teams are collapsible — showing player count by default, expanding to reveal individual players. Parents can customize: reorder teams, reorder players within a team, and pin players into different teams.

## Core Concept

**The parent's question:** "Who is my kid competing against, and how do they stack up?"

**The answer:** A ranked list of previous teams for a given position, with player counts and expandable rosters. The ranking is opinionated by default (age-first, then level) but fully customizable per user.

---

## Data Model

### Existing (no changes needed)
- `players.position` — stores `"F"`, `"D"`, or `"G"`
- `players.previous_team` — stores codes like `"U15AA"`, `"U13A"`, `"U15BB"`, etc.
- `extractLevelFromTeam()` in `lib/utils.ts` — parses level from team code
- `PREVIOUS_TEAMS` in `lib/utils.ts` — canonical team list per age group
- `LEVEL_ORDER` in `lib/utils.ts` — `["AA", "A", "BB", "B", "C"]`

### New: Default Team Sort Order

Define a constant in `lib/utils.ts` that establishes the default tier ranking. Sort by age group first (U15 above U13), then by level within age group:

```
DEFAULT_TEAM_ORDER = [
  "U15AA", "U15A", "U15BB", "U15B", "U15C",
  "U13AA", "U13A", "U13BB", "U13B", "U13C"
]
```

This is the "U15 parents are right" default. Parents who disagree can reorder.

### New: `user_competition_prefs` table (Supabase)

Stores each user's customizations. One row per user.

```sql
create table public.user_competition_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  team_order text[] not null default '{}',  -- custom team sort order (empty = use default)
  player_order jsonb not null default '{}', -- { "U15AA": [playerNum, playerNum, ...], ... }
  pinned_players jsonb not null default '{}', -- { playerNum: { team: "U15AA", position: 2 }, ... }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

RLS: users can only read/write their own row. Same pattern as `user_crew`.

**Fields:**
- `team_order` — array of team codes in the user's preferred sort. Empty array means use `DEFAULT_TEAM_ORDER`.
- `player_order` — JSON object keyed by team code. Each value is an array of player numbers in the user's preferred order within that team. Missing keys = default (alphabetical or by number).
- `pinned_players` — JSON object keyed by player number (as string). Each value has `team` (the team to display them in) and `position` (index within that team's list). When a player is pinned, they appear in the target team's expanded list with a pin indicator and their real team label.

---

## UI Design

### Page: `/home` (replaces current Home page)

#### Position Picker (top of page)
- Three tab-style buttons: **Forward** | **Defense** | **Goalie**
- Default to Forward (or remember last selection in localStorage)
- Shows total player count for selected position

#### Team Tier List (main content)
- Each row represents a previous team
- Only teams with players at the selected position are shown (hide empty teams)
- Each row displays:
  - **Drag handle** (≡) on the left for reordering
  - **Team rank number** (1, 2, 3...)
  - **Team code** (e.g., "U15 AA")
  - **Player count** at this position (including any pinned-in players, noting pinned count separately if > 0)
  - **Expand/collapse chevron** on the right

#### Expanded Team View (when a team row is tapped/clicked)
- Shows individual player cards within that team
- Each card shows:
  - Player name (first + last, or `#number` if name hidden for lite users)
  - Jersey number
  - Pin indicator (📌) + real team label if this player was pinned here from another team
- Players within a team are draggable for reordering
- Long-press or dedicated action to "pin" a player — initiates a move to insert them into a different team's list

#### Reset Button
- Positioned in the page header area (perhaps a small icon button)
- Clears all three layers: team order, player order, and pinned players
- Confirm dialog before clearing ("Reset to default order?")

### Three Layers of Customization

1. **Team order** — drag team rows up/down to reorder tiers
2. **Player order within a team** — expand a team, drag players up/down within it
3. **Player pins** — move a player from their natural team into a different team's list at a specific slot

All customization is:
- **Per user** (stored in `user_competition_prefs`)
- **Global across positions** (team order applies to F, D, and G)
- **Persisted** (survives page refresh, logout/login)
- **Resettable** (single reset button clears everything)

### Player Pin UX Flow

1. User expands a team and sees its players
2. User initiates pin on a player (long-press, or tap a "move" icon)
3. UI enters "placement mode" — team list highlights drop zones
4. User taps a team to expand it, then taps the slot where the player should go
5. Player appears in the new team with a 📌 badge and "(from U13BB)" label
6. Original team shows the player grayed out with "(pinned to U15AA)" note

### Pinned Player Display in Original Team

When a player is pinned elsewhere, their original team still lists them but visually muted:
- Grayed out name
- Note like "→ pinned to U15 AA"
- Player count on the team row reflects the actual roster (pinned-out players still counted in original team's total, but the target team's count also includes them with a "+1 pinned" note)

---

## Implementation Steps

### Phase 1: Data Layer

1. **Add `DEFAULT_TEAM_ORDER` constant** to `lib/utils.ts`
2. **Create `user_competition_prefs` table** in Supabase with RLS policies
3. **Add TypeScript types** to `lib/types.ts`:
   - `UserCompetitionPrefs` interface
   - `PinnedPlayer` interface (`{ team: string, position: number }`)
4. **Create server actions** in `lib/actions/competition-prefs.ts`:
   - `getCompetitionPrefs(userId)` — fetch or return defaults
   - `updateTeamOrder(userId, teamOrder[])` — save custom team sort
   - `updatePlayerOrder(userId, team, playerNumbers[])` — save custom player sort within a team
   - `pinPlayer(userId, playerNumber, targetTeam, position)` — pin a player into a different team
   - `unpinPlayer(userId, playerNumber)` — remove a pin
   - `resetAllPrefs(userId)` — clear everything back to defaults

### Phase 2: Core UI

5. **Rewrite `app/(app)/home/page.tsx`** — new Competition Landscape page:
   - Position picker tabs (F, D, G)
   - Fetch all players with position matching selection
   - Fetch user's competition prefs
   - Group players by `previous_team`
   - Sort teams by user pref or `DEFAULT_TEAM_ORDER`
   - Render collapsible team rows with player counts

6. **Create `components/competition/team-tier-list.tsx`**:
   - Renders the sortable list of team rows
   - Handles drag-and-drop reorder of teams
   - Calls `updateTeamOrder` on reorder

7. **Create `components/competition/team-row.tsx`**:
   - Single team row: drag handle, rank, name, count, expand/collapse
   - Expanded state shows player list

8. **Create `components/competition/player-list.tsx`**:
   - Renders sortable player cards within a team
   - Handles drag-and-drop reorder within team
   - Shows pinned players with badge and origin label
   - Shows pinned-out players as grayed

9. **Create `components/competition/player-card.tsx`**:
   - Individual player display: name, number, pin badge, team origin

### Phase 3: Drag & Drop

10. **Implement drag-and-drop for team reordering**
    - Consider using a lightweight DnD library (e.g., `@dnd-kit/core` + `@dnd-kit/sortable`) or native HTML drag-and-drop
    - On drop: update local state immediately, persist to `user_competition_prefs`
    - `@dnd-kit` is recommended — small bundle, works well with React, accessible, supports both mouse and touch

11. **Implement drag-and-drop for player reordering within a team**
    - Same DnD approach, scoped to the expanded player list
    - On drop: persist order to `player_order` JSON field

### Phase 4: Player Pinning

12. **Implement pin initiation UI**
    - Add a "move" action to each player card (icon button or context menu)
    - Tapping enters "placement mode"

13. **Implement placement mode**
    - Visual state change: teams show drop targets
    - User selects target team, then position within that team
    - On confirm: persist to `pinned_players`, update both teams' displays

14. **Implement unpin**
    - Pinned players show an "unpin" action
    - Removes from `pinned_players`, player returns to original team

### Phase 5: Polish

15. **Reset functionality**
    - Reset button in header
    - Confirmation dialog
    - Calls `resetAllPrefs`, refreshes UI to defaults

16. **Loading & empty states**
    - Skeleton loader while fetching players + prefs
    - Empty state per position ("No goalies registered yet")
    - Handle players with null position (excluded, with a note like "X players have no position set")

17. **Persist position selection**
    - Save last-selected position tab in localStorage
    - Restore on page load

---

## Decisions & Notes

- **Position values:** `"F"` (Forward), `"D"` (Defense), `"G"` (Goalie) — as stored in DB
- **DnD library:** `@dnd-kit` recommended over alternatives. Lightweight, accessible, React-native, supports sortable lists and cross-container moves (needed for pinning)
- **No position-specific team orders:** Team reordering is global (applies to all positions). Simplifies both UX and data model.
- **Lite users:** Still see the competition landscape but player names are hidden per existing `players_view` RLS. They see jersey numbers only.
- **Null positions excluded:** Players without a position set are not shown. This is acceptable pre-tryout since all high-ranked players will have positions filled in.
- **What happens to the old Home content:** The quick links (Browse Teams, Find Players, My Crew, Tryouts) and the crew feed/upcoming sessions are displaced. These are accessible from the main nav. If needed, they could move to a secondary tab or section below the competition landscape, but the primary Home experience becomes the landscape view.

---

## Schema Migration SQL

```sql
-- Competition preferences table
create table public.user_competition_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null unique,
  team_order text[] not null default '{}',
  player_order jsonb not null default '{}',
  pinned_players jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.user_competition_prefs enable row level security;

create policy "Users can read own competition prefs"
  on public.user_competition_prefs for select
  using (auth.uid() = user_id);

create policy "Users can insert own competition prefs"
  on public.user_competition_prefs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own competition prefs"
  on public.user_competition_prefs for update
  using (auth.uid() = user_id);

create policy "Users can delete own competition prefs"
  on public.user_competition_prefs for delete
  using (auth.uid() = user_id);

-- Grants
grant select, insert, update, delete on public.user_competition_prefs to authenticated;
```
