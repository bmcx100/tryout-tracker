# Plan: Per-Position Reset with Confirmation Modal

## Context
Currently, both "Reset" and "Reset All" buttons on the Rank Teams and Resulting Teams views use `window.confirm()` and have inconsistent scoping. The user wants:
- **Reset** = reset only the currently selected position group
- **Reset All** = reset all positions (and team order on Rank Teams)
- Both show a styled modal describing exactly what will be reset

## Files to Modify
- `components/competition/reset-confirm-modal.tsx` — **NEW** reusable confirmation modal
- `app/(app)/home/page.tsx` — Rewrite 4 reset handlers + add modal state
- `app/(app)/home/step-rank-teams.tsx` — No changes needed (already passes onReset/onResetAll)
- `app/(app)/home/results-view.tsx` — No changes needed
- `app/globals.css` — Add modal description list styles (reuse existing slot-modal CSS)

## Step 1: Create `ResetConfirmModal` Component
New file `components/competition/reset-confirm-modal.tsx`. Reuses the existing `slot-modal` CSS pattern (overlay, header, body, footer). Props:
```
title: string
items: string[]       // bullet list of what gets reset
onConfirm: () => void
onCancel: () => void
```
Renders a modal with the title, a `<ul>` of reset items, and Cancel/Reset buttons.

## Step 2: Add Modal State to `page.tsx`
Add state to control the modal:
```
const [resetModal, setResetModal] = useState<{
  title: string
  items: string[]
  onConfirm: () => void
} | null>(null)
```
Render `<ResetConfirmModal>` at the bottom of both the rank and results views when `resetModal` is set.

## Step 3: Rewrite Reset Handlers

### Rank Teams — Reset (current position only)
- Show modal with title "Reset {Position} Rankings"
- Items: "Player order for {position}", "Pinned players for {position}"
- On confirm: filter `globalPlayerOrder` and `globalPinnedPlayers` to remove ONLY players matching the active position (using `playerPositionMap`), preserving other positions' ordering. Save updated global prefs to DB.

### Rank Teams — Reset All
- Show modal with title "Reset All Rankings"
- Items: "Team order", "Player order for all positions", "Pinned players for all positions", "Position overrides"
- On confirm: clear globalTeamOrder, globalPlayerOrder, globalPinnedPlayers, position_overrides. Call `resetPrefs` for global + all 3 position groups.

### Resulting Teams — Reset (current position only)
- If activeGroup is "all", behave like Reset All
- Otherwise show modal with title "Reset {Position} Results"
- Items: "Player order for {position}", "Pinned players for {position}"
- On confirm: reset only that position group's player_order and pinned_players. Team slots and position overrides are NOT cleared (shared across positions, only cleared on Reset All).

### Resulting Teams — Reset All
- Show modal with title "Reset All Results"
- Items: "Player order for all positions", "Pinned players for all positions", "Team roster slots", "Position overrides"
- On confirm: reset all 3 position group prefs

## Step 4: CSS for Modal Description List
Add a simple `.reset-modal-items` class for the bullet list inside the modal body. Reuse all existing `slot-modal-*` classes for the modal structure.

## Verification
- Dev server: `npm run dev`, navigate to /home
- Test Reset on each position tab (forwards/defense/goalies) — should only reset that position's data
- Test Reset All — should reset everything (including team order on rank step)
- Verify modal appears with correct description for each scenario
- `npm run build` to verify no type errors
