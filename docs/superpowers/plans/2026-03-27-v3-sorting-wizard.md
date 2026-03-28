# V3 Sorting Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home page with a step-by-step sorting wizard (pick position, rank teams, see results) with per-position saved state and a clean return visit experience.

**Architecture:** The `/home` route becomes a wizard orchestrator. Wizard state is tracked locally via a `step` state variable. Persistence uses the existing `user_competition_prefs` table with a new `position_group` column so each position (forwards/defense/goalies) has its own saved sort. Existing drag/sort components are reused inside new step wrapper components.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, dnd-kit, Tailwind CSS v4 with @apply classes

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/supabase/schema.sql` | Modify | Add `position_group` and `last_viewed` columns, drop `unique(user_id)` constraint, add `unique(user_id, position_group)` |
| `lib/types.ts` | Modify | Add `position_group` and `last_viewed` to `UserCompetitionPrefs`, add `PositionGroup` type |
| `lib/actions/competition-prefs.ts` | Modify | All actions now accept `positionGroup` parameter, upsert on `(user_id, position_group)` |
| `app/(app)/home/page.tsx` | Rewrite | Wizard orchestrator — routes between steps and results view |
| `app/(app)/home/step-position.tsx` | Create | Step 1 — position picker cards |
| `app/(app)/home/step-rank-teams.tsx` | Create | Step 2 — draggable team ranking |
| `app/(app)/home/step-results.tsx` | Create | Step 3 — resulting rosters with player drag |
| `app/(app)/home/results-view.tsx` | Create | Return visit — last sort display + re-run button |
| `app/globals.css` | Modify | Add wizard step CSS classes |
| `components/competition/new-teams-view.tsx` | Keep | Reused in step-results and results-view (no changes needed) |
| `components/competition/team-tier-list.tsx` | Keep | Reused in step-rank-teams (no changes needed) |

---

## Task 1: Database Migration — Add position_group Column

**Files:**
- Modify: `lib/supabase/schema.sql`

This task prepares the database to store one sort per position group per user instead of one sort per user.

- [ ] **Step 1: Write the migration SQL**

Run this against Supabase SQL editor (or save for reference). The schema.sql file is documentation — update it to reflect the new state.

Migration SQL to run in Supabase dashboard:

```sql
-- Add position_group column with default for existing rows
ALTER TABLE public.user_competition_prefs
  ADD COLUMN position_group text NOT NULL DEFAULT 'forwards';

-- Add last_viewed timestamp
ALTER TABLE public.user_competition_prefs
  ADD COLUMN last_viewed timestamptz NOT NULL DEFAULT now();

-- Drop the old unique constraint on user_id only
ALTER TABLE public.user_competition_prefs
  DROP CONSTRAINT IF EXISTS user_competition_prefs_user_id_key;

-- Add new unique constraint: one row per user per position group
ALTER TABLE public.user_competition_prefs
  ADD CONSTRAINT user_competition_prefs_user_id_position_group_key
    UNIQUE (user_id, position_group);
```

- [ ] **Step 2: Update schema.sql to reflect new state**

In `lib/supabase/schema.sql`, find the `user_competition_prefs` table definition (lines 319-327) and replace it:

```sql
create table public.user_competition_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  position_group text not null default 'forwards',
  team_order text[] not null default '{}',
  player_order jsonb not null default '{}',
  pinned_players jsonb not null default '{}',
  last_viewed timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, position_group)
);
```

Note: The `unique` constraint changed from `user_id` alone to `(user_id, position_group)`.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/schema.sql
git commit -m "feat: add position_group column to user_competition_prefs schema"
```

---

## Task 2: Update Types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add PositionGroup type and update UserCompetitionPrefs**

In `lib/types.ts`, add the `PositionGroup` type after the existing type aliases (after line 17 area), and update the `UserCompetitionPrefs` interface:

Add after the `CorrectionEntityType` line:

```typescript
export type PositionGroup = "forwards" | "defense" | "goalies"
```

Update the `UserCompetitionPrefs` interface (currently lines 131-139) to:

```typescript
export interface UserCompetitionPrefs {
  id: string
  user_id: string
  position_group: PositionGroup
  team_order: string[]
  player_order: Record<string, number[]>
  pinned_players: Record<string, PinnedPlayer>
  last_viewed: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add PositionGroup type and update UserCompetitionPrefs"
```

---

## Task 3: Update Server Actions

**Files:**
- Modify: `lib/actions/competition-prefs.ts`

All actions now take a `positionGroup` parameter. The upsert conflict target changes from `user_id` to `user_id, position_group`. Add new actions for fetching all prefs and updating `last_viewed`.

- [ ] **Step 1: Rewrite competition-prefs.ts**

Replace the entire file content of `lib/actions/competition-prefs.ts` with:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import type { UserCompetitionPrefs, PositionGroup } from "@/lib/types"

export async function getCompetitionPrefs(
  positionGroup: PositionGroup
): Promise<UserCompetitionPrefs | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)
    .single()

  if (error && error.code !== "PGRST116") throw new Error(error.message)
  return data
}

export async function getAllCompetitionPrefs(): Promise<UserCompetitionPrefs[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", user.id)
    .order("last_viewed", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updateTeamOrder(
  positionGroup: PositionGroup,
  teamOrder: string[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      team_order: teamOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function updatePlayerOrder(
  positionGroup: PositionGroup,
  team: string,
  playerNumbers: number[]
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  const playerOrder = existing?.player_order || {}
  playerOrder[team] = playerNumbers

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      player_order: playerOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function pinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number,
  targetTeam: string,
  position: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  const pinnedPlayers = existing?.pinned_players || {}
  pinnedPlayers[String(playerNumber)] = { team: targetTeam, position }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function unpinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  if (!existing) return

  const pinnedPlayers = { ...existing.pinned_players }
  delete pinnedPlayers[String(playerNumber)]

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function markLastViewed(positionGroup: PositionGroup) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      last_viewed: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function resetPrefs(positionGroup: PositionGroup) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("user_competition_prefs")
    .delete()
    .eq("user_id", user.id)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/competition-prefs.ts
git commit -m "feat: scope competition prefs actions to position_group"
```

---

## Task 4: Add Wizard CSS Classes

**Files:**
- Modify: `app/globals.css`

Add CSS classes for the wizard steps. These go in the existing "COMPETITION LANDSCAPE" section of globals.css (after the existing `.comp-instructions` block, around line 3425).

- [ ] **Step 1: Add wizard CSS classes**

Add these classes right after the `.comp-instructions svg` block (after line 3425 in globals.css):

```css
/* Wizard Flow */

.wizard-container {
  @apply flex flex-col items-center;
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 0;
}

.wizard-headline {
  font-family: var(--font-heading);
  font-size: 28px;
  font-weight: 700;
  color: #111111;
  margin-bottom: 8px;
  text-align: center;
}

.wizard-subtext {
  font-family: var(--font-data);
  font-size: 14px;
  color: #6B6560;
  text-align: center;
  line-height: 1.5;
  margin-bottom: 32px;
  max-width: 360px;
}

.wizard-cards {
  @apply flex flex-col gap-3;
  width: 100%;
}

.wizard-card {
  @apply flex items-center justify-between;
  width: 100%;
  padding: 20px 24px;
  border: 2px solid rgba(17, 17, 17, 0.12);
  border-radius: 0.5rem;
  background: var(--color-concrete);
  cursor: pointer;
  transition: border-color 150ms, background 150ms;
  font-family: var(--font-heading);
  font-size: 18px;
  font-weight: 600;
  color: #111111;
}

.wizard-card:hover {
  border-color: rgba(17, 17, 17, 0.3);
  background: var(--color-ash);
}

.wizard-card-arrow {
  color: #6B6560;
  transition: transform 150ms;
}

.wizard-card:hover .wizard-card-arrow {
  transform: translateX(4px);
}

.wizard-reuse-option {
  width: 100%;
  margin-top: 24px;
  padding: 14px 20px;
  border: 2px dashed rgba(17, 17, 17, 0.12);
  border-radius: 0.5rem;
  background: none;
  cursor: pointer;
  font-family: var(--font-data);
  font-size: 13px;
  color: #6B6560;
  text-align: center;
  transition: border-color 150ms, color 150ms;
}

.wizard-reuse-option:hover {
  border-color: rgba(17, 17, 17, 0.3);
  color: #111111;
}

.wizard-next-btn {
  @apply flex items-center justify-center gap-2;
  width: 100%;
  margin-top: 24px;
  padding: 14px 24px;
  background: #E63B2E;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 150ms;
}

.wizard-next-btn:hover {
  background: #d4342a;
}

.wizard-back-btn {
  margin-top: 12px;
  padding: 10px 24px;
  background: none;
  color: #6B6560;
  border: 2px solid rgba(17, 17, 17, 0.12);
  border-radius: 0.5rem;
  font-family: var(--font-data);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: color 150ms, border-color 150ms;
  width: 100%;
  text-align: center;
}

.wizard-back-btn:hover {
  color: #111111;
  border-color: rgba(17, 17, 17, 0.24);
}

/* Results View (return visit) */

.results-header {
  @apply flex items-center justify-between;
  margin-bottom: 24px;
  max-width: 480px;
}

.results-label {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: 700;
  color: #111111;
}

.results-run-btn {
  @apply flex items-center gap-2;
  padding: 10px 20px;
  background: #E63B2E;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-family: var(--font-data);
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 150ms;
}

.results-run-btn:hover {
  background: #d4342a;
}

.results-content {
  max-width: 480px;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add wizard and results-view CSS classes"
```

---

## Task 5: Build Step 1 — Position Picker

**Files:**
- Create: `app/(app)/home/step-position.tsx`

- [ ] **Step 1: Create step-position.tsx**

Create `app/(app)/home/step-position.tsx`:

```tsx
"use client"

import { ChevronRight } from "lucide-react"
import type { PositionGroup, UserCompetitionPrefs } from "@/lib/types"

interface StepPositionProps {
  existingPrefs: UserCompetitionPrefs[]
  onSelect: (group: PositionGroup, reuseTeamOrder: string[] | null) => void
}

const POSITION_LABELS: Record<PositionGroup, string> = {
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
}

export function StepPosition({ existingPrefs, onSelect }: StepPositionProps) {
  const mostRecent = existingPrefs.length > 0 ? existingPrefs[0] : null
  const completedGroups = new Set(existingPrefs.map((p) => p.position_group))

  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Pick a position</h1>
      <p className="wizard-subtext">
        You'll rank the teams, then see where everyone lands.
      </p>

      <div className="wizard-cards">
        {(["forwards", "defense", "goalies"] as PositionGroup[]).map((group) => (
          <button
            key={group}
            className="wizard-card"
            onClick={() => onSelect(group, null)}
          >
            {POSITION_LABELS[group]}
            <ChevronRight size={20} className="wizard-card-arrow" />
          </button>
        ))}
      </div>

      {mostRecent && (
        <div>
          {(["forwards", "defense", "goalies"] as PositionGroup[])
            .filter((g) => !completedGroups.has(g))
            .slice(0, 1)
            .map((group) => (
              <button
                key={group}
                className="wizard-reuse-option"
                onClick={() => onSelect(group, mostRecent.team_order)}
              >
                Start {POSITION_LABELS[group]} with your {POSITION_LABELS[mostRecent.position_group]} team order
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors related to step-position.tsx (may have pre-existing errors elsewhere).

- [ ] **Step 3: Commit**

```bash
git add app/(app)/home/step-position.tsx
git commit -m "feat: add Step 1 position picker component"
```

---

## Task 6: Build Step 2 — Rank Teams

**Files:**
- Create: `app/(app)/home/step-rank-teams.tsx`

This step wraps the existing `TeamTierList` component but only shows team rows (no player expansion needed at this stage). However, the existing component already handles team drag — we reuse it directly.

- [ ] **Step 1: Create step-rank-teams.tsx**

Create `app/(app)/home/step-rank-teams.tsx`:

```tsx
"use client"

import { useCallback } from "react"
import { TeamTierList } from "@/components/competition/team-tier-list"
import type { Player, PinnedPlayer } from "@/lib/types"

interface StepRankTeamsProps {
  teamOrder: string[]
  playersByTeam: Record<string, Player[]>
  allPlayers: Player[]
  playerOrderMap: Record<string, number[]>
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  onTeamReorder: (newOrder: string[]) => void
  onPlayerReorder: (team: string, playerNumbers: number[]) => void
  onPinToTeam: (playerNumber: number, targetTeam: string, pos: number) => void
  onUnpin: (playerNumber: number) => void
  onNext: () => void
  onBack: () => void
}

export function StepRankTeams({
  teamOrder,
  playersByTeam,
  allPlayers,
  playerOrderMap,
  pinnedPlayers,
  crewNumbers,
  onTeamReorder,
  onPlayerReorder,
  onPinToTeam,
  onUnpin,
  onNext,
  onBack,
}: StepRankTeamsProps) {
  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Rank the teams</h1>
      <p className="wizard-subtext">
        Drag teams from strongest to weakest. Players from higher-ranked teams will fill top spots first.
      </p>

      <div className="comp-content">
        <TeamTierList
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={allPlayers}
          playerOrderMap={playerOrderMap}
          pinnedPlayers={pinnedPlayers}
          crewNumbers={crewNumbers}
          onTeamReorder={onTeamReorder}
          onPlayerReorder={onPlayerReorder}
          onPinToTeam={onPinToTeam}
          onUnpin={onUnpin}
        />
      </div>

      <button className="wizard-next-btn" onClick={onNext}>
        Next
      </button>
      <button className="wizard-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/home/step-rank-teams.tsx
git commit -m "feat: add Step 2 rank teams component"
```

---

## Task 7: Build Step 3 — Results

**Files:**
- Create: `app/(app)/home/step-results.tsx`

This step shows the `NewTeamsView` with a "Done" button. The position is already filtered (not "ALL") since the user picked a specific position group in Step 1.

- [ ] **Step 1: Create step-results.tsx**

Create `app/(app)/home/step-results.tsx`:

```tsx
"use client"

import { NewTeamsView } from "@/components/competition/new-teams-view"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"
import type { Position } from "@/lib/utils"

const GROUP_TO_POSITION: Record<PositionGroup, Position> = {
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const GROUP_LABELS: Record<PositionGroup, string> = {
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
}

interface StepResultsProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  crewNumbers: Set<number>
  onDone: () => void
  onBack: () => void
}

export function StepResults({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  crewNumbers,
  onDone,
  onBack,
}: StepResultsProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="wizard-container">
      <h1 className="wizard-headline">Here's how it shakes out</h1>
      <p className="wizard-subtext">
        These are the projected {GROUP_LABELS[positionGroup].toLowerCase()} rosters based on your ranking. Drag players between teams to fine-tune.
      </p>

      <div className="comp-content">
        <NewTeamsView
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={playerOrderMap}
          position={position}
          crewNumbers={crewNumbers}
        />
      </div>

      <button className="wizard-next-btn" onClick={onDone}>
        Done
      </button>
      <button className="wizard-back-btn" onClick={onBack}>
        Back
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/home/step-results.tsx
git commit -m "feat: add Step 3 results component"
```

---

## Task 8: Build Results View (Return Visit)

**Files:**
- Create: `app/(app)/home/results-view.tsx`

This is what returning users see — their last completed sort with a clear label and a button to re-run.

- [ ] **Step 1: Create results-view.tsx**

Create `app/(app)/home/results-view.tsx`:

```tsx
"use client"

import { RotateCcw } from "lucide-react"
import { NewTeamsView } from "@/components/competition/new-teams-view"
import type { Player, PinnedPlayer, PositionGroup } from "@/lib/types"
import type { Position } from "@/lib/utils"

const GROUP_TO_POSITION: Record<PositionGroup, Position> = {
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const GROUP_LABELS: Record<PositionGroup, string> = {
  forwards: "Forwards",
  defense: "Defense",
  goalies: "Goalies",
}

interface ResultsViewProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  crewNumbers: Set<number>
  onRunSorter: () => void
}

export function ResultsView({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  crewNumbers,
  onRunSorter,
}: ResultsViewProps) {
  const position = GROUP_TO_POSITION[positionGroup]

  return (
    <div className="app-page">
      <div className="results-header">
        <h1 className="results-label">
          Your {GROUP_LABELS[positionGroup]} Sort
        </h1>
        <button className="results-run-btn" onClick={onRunSorter}>
          <RotateCcw size={14} />
          Run the Sorter
        </button>
      </div>

      <div className="results-content">
        <NewTeamsView
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={playerOrderMap}
          position={position}
          crewNumbers={crewNumbers}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/home/results-view.tsx
git commit -m "feat: add results view component for return visits"
```

---

## Task 9: Rewrite Home Page Orchestrator

**Files:**
- Rewrite: `app/(app)/home/page.tsx`

This is the main task — wiring everything together. The page checks for existing prefs, routes to the wizard or results view, and manages all state transitions.

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire content of `app/(app)/home/page.tsx` with:

```tsx
"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { StepPosition } from "./step-position"
import { StepRankTeams } from "./step-rank-teams"
import { StepResults } from "./step-results"
import { ResultsView } from "./results-view"
import type {
  Player,
  UserCompetitionPrefs,
  PinnedPlayer,
  CrewMember,
  PositionGroup,
} from "@/lib/types"
import { DEFAULT_TEAM_ORDER } from "@/lib/utils"
import {
  updateTeamOrder,
  updatePlayerOrder,
  pinPlayer,
  unpinPlayer,
  markLastViewed,
} from "@/lib/actions/competition-prefs"

type WizardStep = "position" | "rank" | "results" | "done"

const POSITION_FILTER: Record<PositionGroup, string> = {
  forwards: "F",
  defense: "D",
  goalies: "G",
}

const defaultPrefs: UserCompetitionPrefs = {
  id: "",
  user_id: "",
  position_group: "forwards",
  team_order: [],
  player_order: {},
  pinned_players: {},
  last_viewed: "",
  created_at: "",
  updated_at: "",
}

export default function HomePage() {
  const { loading: authLoading } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [allPrefs, setAllPrefs] = useState<UserCompetitionPrefs[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Wizard state
  const [step, setStep] = useState<WizardStep>("position")
  const [activeGroup, setActiveGroup] = useState<PositionGroup>("forwards")
  const [currentPrefs, setCurrentPrefs] = useState<UserCompetitionPrefs>(defaultPrefs)

  useEffect(() => {
    if (authLoading) return

    const load = async () => {
      try {
        const supabase = createClient()

        const [playersRes, prefsRes, crewRes] = await Promise.all([
          supabase
            .from("players_view")
            .select("*")
            .not("position", "is", null)
            .not("previous_team", "is", null),
          supabase
            .from("user_competition_prefs")
            .select("*")
            .order("last_viewed", { ascending: false }),
          supabase
            .from("user_crew")
            .select("*"),
        ])

        if (playersRes.error) throw new Error(playersRes.error.message)
        setPlayers(playersRes.data || [])
        if (crewRes.data) setCrew(crewRes.data)

        const prefs = prefsRes.data || []
        setAllPrefs(prefs)

        // If user has existing sorts, show results view of most recent
        if (prefs.length > 0) {
          const mostRecent = prefs[0]
          setCurrentPrefs(mostRecent)
          setActiveGroup(mostRecent.position_group)
          setStep("done")
        }

        setLoading(false)
      } catch (err) {
        console.error("Home load error:", err)
        setError(err instanceof Error ? err.message : "Failed to load")
        setLoading(false)
      }
    }
    load()
  }, [authLoading])

  const crewNumbers = new Set(crew.map((c) => c.player_number))

  // Filter players by the active position group
  const positionFilter = POSITION_FILTER[activeGroup]
  const filtered = players.filter((p) => p.position === positionFilter)

  const teamOrder = currentPrefs.team_order?.length
    ? currentPrefs.team_order
    : DEFAULT_TEAM_ORDER

  const pinnedPlayers: Record<string, PinnedPlayer> = currentPrefs.pinned_players || {}

  // Group players by previous_team for the rank step
  const playersByTeam: Record<string, Player[]> = {}
  for (const p of filtered) {
    const team = p.previous_team || "Unknown"
    if (!playersByTeam[team]) playersByTeam[team] = []
    playersByTeam[team].push(p)
  }
  for (const team of Object.keys(playersByTeam)) {
    const customOrder = currentPrefs.player_order?.[team]
    if (customOrder?.length) {
      playersByTeam[team].sort((a, b) => {
        const ai = customOrder.indexOf(a.number)
        const bi = customOrder.indexOf(b.number)
        if (ai === -1 && bi === -1) return a.number - b.number
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    } else {
      playersByTeam[team].sort((a, b) => a.number - b.number)
    }
  }

  // Wizard handlers
  const handleSelectPosition = useCallback(
    (group: PositionGroup, reuseTeamOrder: string[] | null) => {
      setActiveGroup(group)
      const existing = allPrefs.find((p) => p.position_group === group)
      if (existing) {
        setCurrentPrefs(existing)
      } else {
        setCurrentPrefs({
          ...defaultPrefs,
          position_group: group,
          team_order: reuseTeamOrder || [],
        })
      }
      setStep("rank")
    },
    [allPrefs]
  )

  const handleTeamReorder = useCallback(
    async (newOrder: string[]) => {
      setCurrentPrefs((prev) => ({ ...prev, team_order: newOrder }))
      try {
        await updateTeamOrder(activeGroup, newOrder)
      } catch (err) {
        console.error("Failed to save team order:", err)
      }
    },
    [activeGroup]
  )

  const handlePlayerReorder = useCallback(
    async (team: string, playerNumbers: number[]) => {
      setCurrentPrefs((prev) => ({
        ...prev,
        player_order: { ...prev.player_order, [team]: playerNumbers },
      }))
      try {
        await updatePlayerOrder(activeGroup, team, playerNumbers)
      } catch (err) {
        console.error("Failed to save player order:", err)
      }
    },
    [activeGroup]
  )

  const handlePinToTeam = useCallback(
    async (playerNumber: number, targetTeam: string, pos: number) => {
      setCurrentPrefs((prev) => ({
        ...prev,
        pinned_players: {
          ...prev.pinned_players,
          [String(playerNumber)]: { team: targetTeam, position: pos },
        },
      }))
      try {
        await pinPlayer(activeGroup, playerNumber, targetTeam, pos)
      } catch (err) {
        console.error("Failed to pin player:", err)
      }
    },
    [activeGroup]
  )

  const handleUnpin = useCallback(
    async (playerNumber: number) => {
      setCurrentPrefs((prev) => {
        const pp = { ...prev.pinned_players }
        delete pp[String(playerNumber)]
        return { ...prev, pinned_players: pp }
      })
      try {
        await unpinPlayer(activeGroup, playerNumber)
      } catch (err) {
        console.error("Failed to unpin player:", err)
      }
    },
    [activeGroup]
  )

  const handleWizardDone = useCallback(async () => {
    try {
      await markLastViewed(activeGroup)
    } catch (err) {
      console.error("Failed to mark last viewed:", err)
    }
    // Update allPrefs so results view shows current data
    setAllPrefs((prev) => {
      const updated = prev.filter((p) => p.position_group !== activeGroup)
      return [currentPrefs, ...updated]
    })
    setStep("done")
  }, [activeGroup, currentPrefs])

  const handleRunSorter = useCallback(() => {
    setStep("position")
  }, [])

  if (loading) {
    return (
      <div className="app-page">
        <div className="home-loading">
          <div className="loading-dots">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <p className="home-loading-text">Loading players...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-page">
        <div className="app-empty-state">
          <p className="app-empty-title">Something went wrong</p>
          <p className="app-empty-desc">{error}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (step === "position") {
    return (
      <div className="app-page">
        <StepPosition
          existingPrefs={allPrefs}
          onSelect={handleSelectPosition}
        />
      </div>
    )
  }

  if (step === "rank") {
    return (
      <div className="app-page">
        <StepRankTeams
          teamOrder={teamOrder}
          playersByTeam={playersByTeam}
          allPlayers={filtered}
          playerOrderMap={currentPrefs.player_order || {}}
          pinnedPlayers={pinnedPlayers}
          crewNumbers={crewNumbers}
          onTeamReorder={handleTeamReorder}
          onPlayerReorder={handlePlayerReorder}
          onPinToTeam={handlePinToTeam}
          onUnpin={handleUnpin}
          onNext={() => setStep("results")}
          onBack={() => setStep("position")}
        />
      </div>
    )
  }

  if (step === "results") {
    return (
      <div className="app-page">
        <StepResults
          positionGroup={activeGroup}
          teamOrder={teamOrder}
          players={players}
          pinnedPlayers={pinnedPlayers}
          playerOrderMap={currentPrefs.player_order || {}}
          crewNumbers={crewNumbers}
          onDone={handleWizardDone}
          onBack={() => setStep("rank")}
        />
      </div>
    )
  }

  // step === "done" — results view (return visit)
  return (
    <ResultsView
      positionGroup={activeGroup}
      teamOrder={teamOrder}
      players={players}
      pinnedPlayers={pinnedPlayers}
      playerOrderMap={currentPrefs.player_order || {}}
      crewNumbers={crewNumbers}
      onRunSorter={handleRunSorter}
    />
  )
}
```

- [ ] **Step 2: Verify build compiles**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds with no errors related to home page or competition prefs.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/home/page.tsx
git commit -m "feat: replace Home page with V3 sorting wizard"
```

---

## Task 10: Run the Database Migration

**Files:** None (Supabase dashboard action)

- [ ] **Step 1: Run the migration SQL in Supabase**

Open the Supabase SQL editor and run the migration from Task 1 Step 1:

```sql
ALTER TABLE public.user_competition_prefs
  ADD COLUMN position_group text NOT NULL DEFAULT 'forwards';

ALTER TABLE public.user_competition_prefs
  ADD COLUMN last_viewed timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.user_competition_prefs
  DROP CONSTRAINT IF EXISTS user_competition_prefs_user_id_key;

ALTER TABLE public.user_competition_prefs
  ADD CONSTRAINT user_competition_prefs_user_id_position_group_key
    UNIQUE (user_id, position_group);
```

- [ ] **Step 2: Verify the migration**

In Supabase SQL editor, run:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_competition_prefs'
ORDER BY ordinal_position;
```

Expected: You should see `position_group` (text, NOT NULL, default 'forwards') and `last_viewed` (timestamptz) columns in the output.

---

## Task 11: Manual Smoke Test

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test first-time wizard flow**

1. Open `/home` in the browser
2. Verify you see "Pick a position" with three cards: Forwards, Defense, Goalies
3. Click "Forwards"
4. Verify you see "Rank the teams" with draggable team list
5. Drag a team to reorder
6. Click "Next"
7. Verify you see "Here's how it shakes out" with projected rosters
8. Click "Done"
9. Verify you see "Your Forwards Sort" with the results and "Run the Sorter" button

- [ ] **Step 3: Test return visit**

1. Refresh the page
2. Verify you land on "Your Forwards Sort" results view (not the wizard)
3. Click "Run the Sorter"
4. Verify you're back at "Pick a position"
5. Verify the reuse option appears (e.g., "Start Defense with your Forwards team order")

- [ ] **Step 4: Test second position run**

1. Click "Defense" from position picker
2. Go through rank → results → done
3. Refresh — verify the most recent sort (Defense) is shown

- [ ] **Step 5: Final commit with any fixes**

If any issues were found and fixed during testing:

```bash
git add -A
git commit -m "fix: address issues found during V3 wizard smoke test"
```
