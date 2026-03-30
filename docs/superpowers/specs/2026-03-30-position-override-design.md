# Per-User Position Override (F↔D Switch)

## Summary

Users can long-press on a player's position badge (F or D) in the resulting teams view to switch that player between Forward and Defense. The override is persisted per-user in the database, visually indicated with Signal orange highlighting, and cleared by the existing reset button.

## Interaction Flow

1. **Long-press (500ms) on F or D badge** next to a player name in the resulting teams roster
2. **Confirmation modal appears** — "Switch Position" header, shows player name + number, visual arrow from current position to new position (new position highlighted in Signal orange)
3. **Confirm** — position badge changes to the new value, rendered in Signal orange (#E63B2E) with white text. Team header position counts update to reflect the switch. Override saved to DB.
4. **Long-press an already-overridden badge** — same modal, but switching back to the original position. On confirm, override is removed, badge returns to normal styling.
5. **Reset button** — clears all position overrides along with other customizations (existing resetPrefs behavior deletes the row).

## Constraints

- F↔D only — goalies are never switchable
- Per-user, private via RLS — other users never see the override
- Does not modify the global `players` table — only stored in `user_competition_prefs`

## Data Storage

### Database

Add `position_overrides jsonb not null default '{}'` column to `user_competition_prefs`.

Structure: `{ "<player_number>": "<new_position>" }` — e.g., `{ "17": "D", "42": "F" }`.

Synced to all three position group rows (forwards, defense, goalies) using the same pattern as `team_slots`. This ensures the override is visible regardless of which position tab is active.

Cleared automatically when `resetPrefs()` deletes the row.

### TypeScript

Add `position_overrides: Record<string, string>` to `UserCompetitionPrefs` interface.

## How Overrides Apply

A helper function `applyPositionOverrides(players, overrides)` takes the players array and the override map, returning a new array with positions swapped for overridden players. This is applied before the ranking/assignment logic so all downstream computation (position filtering, team assignment, counting) works with effective positions.

## Components

### New: `PositionSwitchModal`

Lives in `resulting-teams-dnd.tsx` alongside the existing `SlotEditorModal`. Same visual pattern: portal overlay (`slot-modal-overlay`), modal card with header/body/footer, Cancel and Confirm buttons. Body shows player name, current position badge → new position badge (new one in Signal orange).

### Modified: `DraggablePlayerRow`

- Position badge (`comp-player-pos`) gets long-press handler (500ms, same as team header)
- Only triggers for F or D positions
- Receives `positionOverrides` map and `onPositionOverride` callback as props
- When player number is in overrides map, applies `comp-player-pos-override` class to the badge and displays the overridden position value

### Modified: `DroppableTeam`

- Position counts (fCount, dCount, gCount) computed from effective (overridden) positions
- Passes override props through to `DraggablePlayerRow`

### Modified: `ResultingTeamsDnd`

- Accepts `positionOverrides` and `onPositionOverride` props
- Applies overrides to players before passing to `buildRankedList`
- Manages modal state (which player is being switched)

### Modified: `ResultsView`

- Passes `positionOverrides` and `onPositionOverride` through to `ResultingTeamsDnd`

### Modified: `HomePage`

- Loads `position_overrides` from prefs on mount
- Manages local `positionOverrides` state
- `handlePositionOverride(playerNumber, newPosition)` — updates local state + saves to all 3 position group rows via server action
- `handleResultsReset` — clears `positionOverrides` local state (DB clearing already handled by `resetPrefs`)

## Server Action

New `updatePositionOverrides()` in `lib/actions/competition-prefs.ts`:
- Accepts `positionGroup`, `playerNumber`, `newPosition` (or null to remove)
- Reads existing prefs, updates `position_overrides` map
- Upserts to DB

## Styling

New class in `app/globals.css`:

```css
.comp-player-pos-override {
  @apply text-white;
  background: var(--color-signal);
}
```

Applied to the position badge span when the player has an active override.

## Files Changed

| File | Change |
|------|--------|
| `lib/types.ts` | Add `position_overrides` to `UserCompetitionPrefs` |
| `lib/supabase/schema.sql` | Add `position_overrides` column |
| `lib/actions/competition-prefs.ts` | New `updatePositionOverrides()` action |
| `components/competition/resulting-teams-dnd.tsx` | Long-press on badge, `PositionSwitchModal`, apply overrides |
| `app/(app)/home/results-view.tsx` | Pass through override props |
| `app/(app)/home/page.tsx` | Manage override state, save/reset handlers |
| `app/globals.css` | `.comp-player-pos-override` class |