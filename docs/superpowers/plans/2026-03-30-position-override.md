# Position Override (F↔D Switch) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users long-press a player's position badge in resulting teams to switch F↔D, persisted per-user in the database with visual orange indicator.

**Architecture:** Add `position_overrides` JSONB column to `user_competition_prefs`, synced to all 3 position group rows (same pattern as `team_slots`). Overrides applied at render time before ranking logic. Long-press triggers confirmation modal, same visual pattern as existing `SlotEditorModal`.

**Tech Stack:** Next.js 16, React 19, Supabase, TypeScript, Tailwind v4 with @apply

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/supabase/schema.sql:326` | Modify | Add `position_overrides` column |
| `lib/types.ts:99-110` | Modify | Add field to `UserCompetitionPrefs` interface |
| `lib/actions/competition-prefs.ts` | Modify | New `updatePositionOverrides()` server action |
| `components/competition/resulting-teams-dnd.tsx` | Modify | Long-press handler, modal, apply overrides |
| `app/(app)/home/results-view.tsx` | Modify | Pass override props through |
| `app/(app)/home/page.tsx` | Modify | Manage state, save handler, clear on reset |
| `app/globals.css:3590` | Modify | Add `.comp-player-pos-override` class |

---

### Task 1: Database Schema + TypeScript Type

**Files:**
- Modify: `lib/supabase/schema.sql:326`
- Modify: `lib/types.ts:99-110`

- [ ] **Step 1: Add column to schema.sql**

In `lib/supabase/schema.sql`, add `position_overrides` after the `team_slots` line (line 326):

```sql
  team_slots jsonb not null default '{}',
  position_overrides jsonb not null default '{}',
```

- [ ] **Step 2: Run migration on Supabase**

Run this SQL in the Supabase dashboard SQL editor (or via CLI):

```sql
alter table public.user_competition_prefs
  add column if not exists position_overrides jsonb not null default '{}';
```

- [ ] **Step 3: Add field to TypeScript interface**

In `lib/types.ts`, add `position_overrides` to the `UserCompetitionPrefs` interface after `team_slots`:

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/schema.sql lib/types.ts
git commit -m "feat: add position_overrides column to user_competition_prefs"
```

---

### Task 2: Server Action

**Files:**
- Modify: `lib/actions/competition-prefs.ts`

- [ ] **Step 1: Add updatePositionOverrides function**

Add this function to the end of `lib/actions/competition-prefs.ts` (before the closing of the file, after `resetPrefs`):

```typescript
export async function updatePositionOverrides(
  positionGroup: PositionGroup,
  playerNumber: number,
  newPosition: string | null
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const existing = await getCompetitionPrefs(positionGroup)
  const overrides = existing?.position_overrides || {}
  if (newPosition) {
    overrides[String(playerNumber)] = newPosition
  } else {
    delete overrides[String(playerNumber)]
  }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: user.id,
      position_group: positionGroup,
      position_overrides: overrides,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,position_group" })

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/competition-prefs.ts
git commit -m "feat: add updatePositionOverrides server action"
```

---

### Task 3: CSS Styling

**Files:**
- Modify: `app/globals.css:3591`

- [ ] **Step 1: Add override class**

In `app/globals.css`, add the override class immediately after the `.comp-player-pos` block (after line 3591):

```css
.comp-player-pos-override {
  background: var(--color-signal);
  color: white;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add position override badge styling"
```

---

### Task 4: ResultingTeamsDnd — Apply Overrides + Modal + Long-Press

**Files:**
- Modify: `components/competition/resulting-teams-dnd.tsx`

This is the largest task. It modifies the main component to:
1. Accept override props
2. Apply overrides to player positions before rendering
3. Add long-press handler to position badges
4. Add the confirmation modal

- [ ] **Step 1: Update the props interface**

In `components/competition/resulting-teams-dnd.tsx`, update `ResultingTeamsDndProps` (line 55) to add the two new props:

```typescript
interface ResultingTeamsDndProps {
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  teamSlots: Record<string, Record<string, number>>
  position: "F" | "D" | "G" | "ALL"
  crewNumbers: Set<number>
  positionOverrides: Record<string, string>
  onReorder: (team: string, playerNumbers: number[]) => void
  onUpdateTeamSlots: (teamCode: string, slots: Record<string, number> | null) => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
}
```

- [ ] **Step 2: Add the applyPositionOverrides helper**

Add this function after the `getTeamSlots` / `isCustomSlots` helpers (around line 53):

```typescript
function applyPositionOverrides(
  players: Player[],
  overrides: Record<string, string>
): Player[] {
  if (!overrides || Object.keys(overrides).length === 0) return players
  return players.map((p) => {
    const override = overrides[String(p.number)]
    if (override && override !== p.position) {
      return { ...p, position: override }
    }
    return p
  })
}
```

- [ ] **Step 3: Add the PositionSwitchModal component**

Add this component after the `SlotEditorModal` component (after line 270):

```typescript
function PositionSwitchModal({
  player,
  originalPosition,
  onConfirm,
  onClose,
}: {
  player: Player
  originalPosition: string
  onConfirm: () => void
  onClose: () => void
}) {
  const currentPos = player.position
  const newPos = currentPos === "F" ? "D" : "F"
  const isReverting = currentPos !== originalPosition

  return (
    <div className="slot-modal-overlay" onClick={onClose}>
      <div className="slot-modal" onClick={(e) => e.stopPropagation()}>
        <div className="slot-modal-header">
          <span className="slot-modal-title">Switch Position</span>
          <button className="slot-modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="slot-modal-body">
          <p className="pos-switch-player">
            {playerName(player.first_name, player.last_name, player.number)} (#{player.number})
          </p>
          <div className="pos-switch-arrow">
            <span className="pos-switch-badge">{currentPos}</span>
            <span className="pos-switch-icon">→</span>
            <span className="pos-switch-badge pos-switch-badge-new">{newPos}</span>
          </div>
          {isReverting && (
            <p className="pos-switch-revert">Restoring original position</p>
          )}
        </div>
        <div className="slot-modal-footer">
          <button className="slot-reset-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="slot-save-btn" onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Update DraggablePlayerRow to support long-press on position badge**

Replace the `DraggablePlayerRow` component (lines 122-172) with this version that accepts override-related props and adds long-press to the position badge:

```typescript
function DraggablePlayerRow({
  player,
  rank,
  isCrew,
  isPinned,
  showDivider,
  isOverridden,
  onLongPressPosition,
}: {
  player: Player
  rank: number
  isCrew: boolean
  isPinned: boolean
  showDivider?: boolean
  isOverridden: boolean
  onLongPressPosition?: (player: Player) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `rp-${player.number}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const posLongPress = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didPosLongPress = useRef(false)

  const canSwitch = player.position === "F" || player.position === "D"

  const handlePosPointerDown = (e: React.PointerEvent) => {
    if (!canSwitch || !onLongPressPosition) return
    e.stopPropagation()
    didPosLongPress.current = false
    posLongPress.current = setTimeout(() => {
      didPosLongPress.current = true
      onLongPressPosition(player)
    }, 500)
  }

  const handlePosPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation()
    if (posLongPress.current) {
      clearTimeout(posLongPress.current)
      posLongPress.current = null
    }
  }

  const handlePosPointerLeave = () => {
    if (posLongPress.current) {
      clearTimeout(posLongPress.current)
      posLongPress.current = null
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`comp-nt-player${player.position === "D" ? " comp-nt-defense" : ""}${isPinned ? " comp-nt-pinned" : ""}${isCrew ? " comp-nt-crew" : ""}${isDragging ? " comp-player-dragging" : ""}${showDivider ? " comp-position-break" : ""}`}
      {...attributes}
      {...listeners}
    >
      <span className="comp-player-grip">
        <GripVertical size={14} />
      </span>
      <span className="comp-nt-rank">{rank}</span>
      <span className="comp-player-number">#{player.number}</span>
      <span
        className={`comp-player-pos${isOverridden ? " comp-player-pos-override" : ""}`}
        onPointerDown={canSwitch ? handlePosPointerDown : undefined}
        onPointerUp={canSwitch ? handlePosPointerUp : undefined}
        onPointerLeave={canSwitch ? handlePosPointerLeave : undefined}
      >
        {player.position}
      </span>
      <span className="comp-player-name">
        {playerName(player.first_name, player.last_name, player.number)}
      </span>
      {isCrew && <Heart size={12} className="comp-player-heart" />}
      {player.previous_team && (
        <span className="comp-nt-prev-team">{player.previous_team}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update DroppableTeam to pass override props and compute counts from effective positions**

Update the `DroppableTeam` component props interface (around line 272) to add the new props:

```typescript
function DroppableTeam({
  teamCode,
  players,
  pinnedPlayers,
  crewNumbers,
  defaultCollapsed,
  isCustom,
  position,
  totalPlayers,
  positionOverrides,
  onOpenSlotEditor,
  onLongPressPosition,
}: {
  teamCode: string
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  crewNumbers: Set<number>
  defaultCollapsed: boolean
  isCustom: boolean
  position: "F" | "D" | "G" | "ALL"
  totalPlayers: number
  positionOverrides: Record<string, string>
  onOpenSlotEditor: (teamCode: string) => void
  onLongPressPosition: (player: Player) => void
})
```

The position counts already compute from `players` which will have overrides applied. No change needed for the count logic — just pass the new props through to `DraggablePlayerRow` inside the render. Update the `DraggablePlayerRow` usage (around line 369):

```typescript
<DraggablePlayerRow
  key={player.number}
  player={player}
  rank={idx + 1}
  isCrew={crewNumbers.has(player.number)}
  isPinned={isPinned}
  showDivider={isPositionBreak}
  isOverridden={!!positionOverrides[String(player.number)]}
  onLongPressPosition={onLongPressPosition}
/>
```

- [ ] **Step 6: Update the main ResultingTeamsDnd component**

Update the component to destructure the new props, apply overrides, and manage modal state. In the component function (line 386+):

1. Destructure the new props:

```typescript
export function ResultingTeamsDnd({
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  teamSlots,
  position,
  crewNumbers,
  positionOverrides,
  onReorder,
  onUpdateTeamSlots,
  onPositionOverride,
}: ResultingTeamsDndProps) {
```

2. Apply overrides to players before the `assignments` useMemo. Add this right after the sensors declaration:

```typescript
  const effectivePlayers = useMemo(
    () => applyPositionOverrides(players, positionOverrides),
    [players, positionOverrides]
  )
```

3. Replace all references to `players` with `effectivePlayers` inside the `assignments` useMemo (line 404) and the `playerPositionMap` equivalent. The `assignments` useMemo dependency array should use `effectivePlayers` instead of `players`.

4. Add modal state after the `slotEditorTeam` state (line 402):

```typescript
  const [slotEditorTeam, setSlotEditorTeam] = useState<string | null>(null)
  const [switchTarget, setSwitchTarget] = useState<Player | null>(null)
```

5. Add the modal confirm handler:

```typescript
  const handleConfirmSwitch = useCallback(() => {
    if (!switchTarget) return
    const currentPos = switchTarget.position
    const originalPos = players.find((p) => p.number === switchTarget.number)?.position
    const isReverting = currentPos !== originalPos

    if (isReverting) {
      onPositionOverride(switchTarget.number, null)
    } else {
      const newPos = currentPos === "F" ? "D" : "F"
      onPositionOverride(switchTarget.number, newPos)
    }
    setSwitchTarget(null)
  }, [switchTarget, players, onPositionOverride])
```

6. Pass `positionOverrides` and `onLongPressPosition={setSwitchTarget}` through to each `DroppableTeam` in the render (around line 611):

```typescript
<DroppableTeam
  key={teamCode}
  teamCode={teamCode}
  players={displayRosters[teamCode]}
  pinnedPlayers={pinnedPlayers}
  crewNumbers={crewNumbers}
  defaultCollapsed
  isCustom={isCustomSlots(teamCode, teamSlots)}
  position={position}
  totalPlayers={fullTeamTotals[teamCode] ?? 17}
  positionOverrides={positionOverrides}
  onOpenSlotEditor={setSlotEditorTeam}
  onLongPressPosition={setSwitchTarget}
/>
```

7. Add the modal render after the `SlotEditorModal` (around line 633):

```typescript
      {switchTarget && (
        <PositionSwitchModal
          player={switchTarget}
          originalPosition={players.find((p) => p.number === switchTarget.number)?.position || switchTarget.position}
          onConfirm={handleConfirmSwitch}
          onClose={() => setSwitchTarget(null)}
        />
      )}
```

- [ ] **Step 7: Commit**

```bash
git add components/competition/resulting-teams-dnd.tsx
git commit -m "feat: add position switch modal and long-press on position badge"
```

---

### Task 5: CSS for Position Switch Modal

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add modal body styles**

Add these classes after the `.comp-player-pos-override` class added in Task 3:

```css
.pos-switch-player {
  font-family: var(--font-heading);
  font-weight: 600;
  font-size: 14px;
  text-align: center;
}

.pos-switch-arrow {
  @apply flex items-center justify-center;
  gap: 12px;
  margin-top: 12px;
}

.pos-switch-badge {
  font-family: var(--font-data);
  font-weight: 700;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 14px;
  border-radius: 0.25rem;
  background: rgba(17, 17, 17, 0.06);
  color: #6B6560;
  border: 2px solid rgba(17, 17, 17, 0.12);
}

.pos-switch-badge-new {
  background: var(--color-signal);
  color: white;
  border-color: var(--color-signal);
}

.pos-switch-icon {
  font-size: 20px;
  color: #6B6560;
}

.pos-switch-revert {
  font-family: var(--font-data);
  font-size: 11px;
  color: #6B6560;
  text-align: center;
  margin-top: 8px;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add position switch modal styles"
```

---

### Task 6: Wire Up ResultsView

**Files:**
- Modify: `app/(app)/home/results-view.tsx`

- [ ] **Step 1: Add props and pass through**

Update the `ResultsViewProps` interface and component to accept and pass through the override props:

```typescript
interface ResultsViewProps {
  positionGroup: PositionGroup
  teamOrder: string[]
  players: Player[]
  pinnedPlayers: Record<string, PinnedPlayer>
  playerOrderMap: Record<string, number[]>
  teamSlots: Record<string, Record<string, number>>
  crewNumbers: Set<number>
  positionOverrides: Record<string, string>
  onReorder: (team: string, playerNumbers: number[]) => void
  onUpdateTeamSlots: (teamCode: string, slots: Record<string, number> | null) => void
  onPositionOverride: (playerNumber: number, newPosition: string | null) => void
  onReset: () => void
  onRunSorter: () => void
  onSwitchPosition: (group: PositionGroup) => void
}
```

Update the destructuring in the component function to include the new props:

```typescript
export function ResultsView({
  positionGroup,
  teamOrder,
  players,
  pinnedPlayers,
  playerOrderMap,
  teamSlots,
  crewNumbers,
  positionOverrides,
  onReorder,
  onUpdateTeamSlots,
  onPositionOverride,
  onReset,
  onRunSorter,
  onSwitchPosition,
}: ResultsViewProps) {
```

Pass the new props to `ResultingTeamsDnd`:

```typescript
<ResultingTeamsDnd
  teamOrder={teamOrder}
  players={players}
  pinnedPlayers={pinnedPlayers}
  playerOrderMap={playerOrderMap}
  teamSlots={teamSlots}
  position={position}
  crewNumbers={crewNumbers}
  positionOverrides={positionOverrides}
  onReorder={onReorder}
  onUpdateTeamSlots={onUpdateTeamSlots}
  onPositionOverride={onPositionOverride}
/>
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/home/results-view.tsx
git commit -m "feat: pass position override props through ResultsView"
```

---

### Task 7: Wire Up HomePage — State, Save, Reset

**Files:**
- Modify: `app/(app)/home/page.tsx`

- [ ] **Step 1: Import the new server action**

Update the import from `competition-prefs` (line 16) to include `updatePositionOverrides`:

```typescript
import {
  updateTeamOrder,
  updatePlayerOrder,
  updateTeamSlots,
  pinPlayer,
  markLastViewed,
  resetPrefs,
  updatePositionOverrides,
} from "@/lib/actions/competition-prefs"
```

- [ ] **Step 2: Add position_overrides to defaultPrefs**

Update the `defaultPrefs` object (line 33) to include the new field:

```typescript
const defaultPrefs: UserCompetitionPrefs = {
  id: "",
  user_id: "",
  position_group: "forwards",
  team_order: [],
  player_order: {},
  pinned_players: {},
  team_slots: {},
  position_overrides: {},
  last_viewed: "",
  created_at: "",
  updated_at: "",
}
```

- [ ] **Step 3: Add the handlePositionOverride callback**

Add this after the `handleUpdateTeamSlots` callback (around line 401):

```typescript
  const handlePositionOverride = useCallback(
    async (playerNumber: number, newPosition: string | null) => {
      // Update local state
      setCurrentPrefs((prev) => {
        const overrides = { ...prev.position_overrides }
        if (newPosition) {
          overrides[String(playerNumber)] = newPosition
        } else {
          delete overrides[String(playerNumber)]
        }
        return { ...prev, position_overrides: overrides }
      })

      // Sync to all three position group rows (like team_slots)
      const positionGroups: PositionGroup[] = ["forwards", "defense", "goalies"]
      setAllPrefs((prev) => {
        const next = [...prev]
        for (const group of positionGroups) {
          const idx = next.findIndex((p) => p.position_group === group)
          if (idx >= 0) {
            const overrides = { ...next[idx].position_overrides }
            if (newPosition) {
              overrides[String(playerNumber)] = newPosition
            } else {
              delete overrides[String(playerNumber)]
            }
            next[idx] = { ...next[idx], position_overrides: overrides }
          }
        }
        return next
      })

      // Save to DB for all three position groups
      try {
        await Promise.all(
          positionGroups.map((group) =>
            updatePositionOverrides(group, playerNumber, newPosition)
          )
        )
      } catch (err) {
        console.error("Failed to save position override:", err)
      }
    },
    []
  )
```

- [ ] **Step 4: Update handleResultsReset to clear position_overrides from local state**

In `handleResultsReset` (line 403), add `position_overrides: {}` to both `setCurrentPrefs` calls. The first one (for "all" tab, line 406):

```typescript
      setCurrentPrefs((prev) => ({
        ...prev,
        player_order: {},
        pinned_players: {},
        team_slots: {},
        position_overrides: {},
      }))
```

And the second one (for single position tab, line 428):

```typescript
      setCurrentPrefs((prev) => ({
        ...prev,
        player_order: {},
        pinned_players: {},
        team_slots: {},
        position_overrides: {},
      }))
```

- [ ] **Step 5: Update handleResultsPositionSwitch to include position_overrides when building derived "all" tab**

In the `handleResultsPositionSwitch` callback (line 447), when building the "all" tab state (line 460), merge position_overrides from any tab:

```typescript
      if (group === "all") {
        const derivedPlayerOrder = buildDerivedAllPlayerOrder(allPrefs)
        const anyPrefs = allPrefs.find(
          (p) => p.position_group === "forwards"
            || p.position_group === "defense"
            || p.position_group === "goalies"
        )
        setCurrentPrefs({
          ...defaultPrefs,
          position_group: "all",
          player_order: derivedPlayerOrder,
          team_slots: anyPrefs?.team_slots || {},
          position_overrides: anyPrefs?.position_overrides || {},
        })
      }
```

- [ ] **Step 6: Pass new props to ResultsView**

Update the `ResultsView` render (around line 539) to pass the new props:

```typescript
    <ResultsView
      positionGroup={activeGroup}
      teamOrder={teamOrder}
      players={players}
      pinnedPlayers={globalPinnedPlayers}
      playerOrderMap={resultsPlayerOrderMap}
      teamSlots={currentPrefs.team_slots || {}}
      crewNumbers={crewNumbers}
      positionOverrides={currentPrefs.position_overrides || {}}
      onReorder={handleResultsPlayerReorder}
      onUpdateTeamSlots={handleUpdateTeamSlots}
      onPositionOverride={handlePositionOverride}
      onReset={handleResultsReset}
      onRunSorter={handleRunSorter}
      onSwitchPosition={handleResultsPositionSwitch}
    />
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add app/(app)/home/page.tsx
git commit -m "feat: wire up position override state management and persistence"
```

---

### Task 8: Manual Testing + Final Commit

- [ ] **Step 1: Run dev server and test**

```bash
npm run dev
```

Test the following scenarios:
1. Navigate to resulting teams, expand a team
2. Long-press on an "F" badge — modal appears with F → D
3. Confirm — badge changes to "D" in orange, team header counts update
4. Long-press the orange "D" badge — modal shows "Restoring original position"
5. Confirm — badge reverts to "F", normal styling
6. Override a position, refresh page — override persists
7. Override a position, click Reset — override is cleared
8. Switch between position tabs — override visible on all tabs

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address lint/build issues from position override feature"
```