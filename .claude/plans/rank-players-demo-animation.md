# Rank Existing Players Demo Animation — Implementation Plan

## Context

Step 2 of the rank wizard ("Rank Existing Players") needs a demo animation teaching users how to interact with it — position tabs, expandable teams, and cross-team player dragging. This follows the same visual language as the Step 1 teams demo (white cursor, thought bubble, ~20s cycle) but adds tab clicking, team expanding, and a pointer→hand cursor transition.

**Page:** `app/(app)/home/step-rank-players.tsx`
**Core component:** `components/competition/team-tier-list.tsx` (mode="players" — teams expandable, no team drag, players draggable)

**Goal:** A multi-phase tutorial animation: pointer finger clicks tabs and expands teams, then transitions to grab hand to drag a player between teams.

**Architecture:** A custom hook (`usePlayerRankDemo`) orchestrates 4 phases via JS timeouts (for real state changes) and CSS keyframes (for player drag). A floating cursor overlay renders two Lucide icons (`Pointer` for clicking, `Hand` for grabbing) that crossfade at the transition point. Data attributes on DOM elements enable position measurement without deep prop threading.

---

## Animation Sequence (~20s cycle)

### Phase 1: Tab Demo (~4s)
- White pointer finger appears, moves to the opposite position tab
- "Clicks" it (press effect) → tab switches via real `onSwitchPosition`
- Moves back to original tab, clicks → switches back
- *Purpose: teaches position tabs are interactive*

### Phase 2: Expand Teams (~3s)
- Pointer moves down to first team row, clicks → team 1 expands showing players
- Moves to second team row, clicks → team 2 expands
- *Purpose: teaches teams are expandable (mode="players" shows chevrons)*

### Phase 3: Player Drag (~10s)
- Cursor moves to a player in team 2 (2nd or 3rd, random, not topmost)
- Crossfades from pointer finger → grab hand (when moving from header to player grip)
- Lifts player (shadow appears), thought bubble: "Where would you place this player?"
- Drags player UP into team 1, to middle position
- Players below insertion point in team 1 shift down
- Player nudges down one slot (player above shifts back up, gap visible below — natural insertion look)
- Player drags back to original position in team 2, release
- *Purpose: teaches cross-team drag-and-drop*

### Phase 4: Cleanup (~3s)
- Cursor + thought bubble fade out
- Demo classes removed, state reset

### Behavior
- Runs once automatically when step-rank-players loads
- If no user interaction for 15s after completion, repeats with different random player
- Stops immediately on any user drag
- Tracks used players — never demos same player twice

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `hooks/use-player-rank-demo.ts` | CREATE | Orchestrator hook — all demo logic |
| `app/(app)/home/step-rank-players.tsx` | MODIFY | Wire hook, render cursor overlay, pass demo props |
| `components/competition/team-tier-list.tsx` | MODIFY | Add data attributes, `demoExpandedTeams` prop, forward `onUserInteraction` |
| `components/competition/team-row.tsx` | MODIFY | Add data attributes (`data-team`, `data-team-header`, `data-player-number`), accept `demoExpanded` prop to force expansion |
| `app/globals.css` | MODIFY | Add ~120 lines: keyframes, cursor, label, drag/shift classes |

---

## Task 1: Add data attributes to team-row and team-tier-list

**Files:**
- `components/competition/team-row.tsx`
- `components/competition/team-tier-list.tsx`

Add data attributes to enable DOM measurement from the hook:

- [ ] Add `data-team={teamCode}` to TeamRow root div (`.comp-team-row`)
- [ ] Add `data-team-header={teamCode}` to the team header area within TeamRow
- [ ] Add `data-player-number={player.number}` to each player row within TeamRow's expanded player list
- [ ] Add optional `demoExpanded?: boolean` prop to TeamRow — when true, force the team expanded (override local collapsed state)
- [ ] In TeamTierList, add optional `demoExpandedTeams?: Set<string>` prop, pass `demoExpanded={demoExpandedTeams?.has(teamCode)}` to each TeamRow
- [ ] Add optional `onUserInteraction?: () => void` prop to TeamTierList — call from DndContext `onDragStart` to kill demo
- [ ] Verify build passes

---

## Task 2: Add CSS keyframes and classes

**Files:** `app/globals.css`

All player rank demo CSS uses `--pdemo-` prefix to avoid collision with existing `--demo-` variables.

- [ ] Add cursor overlay classes:
  - `.player-demo-cursor` — absolute position, pointer-events none, z-index 100, white color, `filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4))`
  - `.player-demo-pointer` / `.player-demo-hand` — opacity 0 by default, `transition: opacity 200ms`, `.visible` sets opacity 1
  - `.player-demo-press` — `animation: pdemo-press 0.15s ease` (scale 0.85 → 1)

- [ ] Add thought bubble:
  - `.player-demo-label` — same style as existing `.comp-demo-label` (white bg, rounded, arrow tail via ::after, centered above element)

- [ ] Add player drag keyframe `pdemo-drag` (~10s, single iteration):
  ```
  0-5%:    at source, no shadow
  5-8%:    lift -4px, shadow appears
  8-20%:   move up to --pdemo-target-y in team 1
  20-30%:  hold at target (shifts happen)
  30-40%:  nudge down to --pdemo-jiggle-y (one row below)
  40-50%:  hold (swap visual)
  50-65%:  drag back to original position
  65-70%:  release, shadow fades
  70-100%: idle
  ```

- [ ] Add shift keyframes:
  - `pdemo-shift-down` — translateY(--pdemo-shift) during drag, back to 0 on return
  - `pdemo-shift-up` — translateY(negative --pdemo-shift) during jiggle phase, back to 0

- [ ] Add cursor-follow keyframe `pdemo-cursor-follow` — mirrors drag positions, offset to grip handle

- [ ] Classes: `.comp-player-demo-drag`, `.comp-player-demo-shift-down`, `.comp-player-demo-shift-up`

---

## Task 3: Create usePlayerRankDemo hook

**Files:** `hooks/use-player-rank-demo.ts`

The hook is the brain — manages the state machine and orchestrates everything.

- [ ] Define hook interface:
  ```ts
  interface UsePlayerRankDemoOptions {
    containerRef: RefObject<HTMLDivElement>
    positionGroup: PositionGroup
    onSwitchPosition: (group: PositionGroup) => void
    enabled: boolean // false when user has interacted
  }

  interface UsePlayerRankDemoReturn {
    demoExpandedTeams: Set<string> | undefined
    demoActive: boolean
    cursorPos: { x: number; y: number }
    cursorType: "pointer" | "hand" | null
    showLabel: boolean
    onUserInteraction: () => void
  }
  ```

- [ ] Implement Phase 1 (tabs):
  - Query `.results-position-tab` buttons via containerRef
  - Determine opposite tab from current `positionGroup` (forwards↔defense)
  - setTimeout chain: move cursor → press → call onSwitchPosition → move back → press → call onSwitchPosition
  - CSS transition on cursor position (0.6s ease)

- [ ] Implement Phase 2 (expand):
  - Query `[data-team-header]` elements for first two teams in the tier list
  - setTimeout chain: move to header 1 → press → add to demoExpandedTeams → move to header 2 → press → add

- [ ] Implement Phase 3 (drag):
  - Query `[data-player-number]` in second team, pick random (2nd-4th, not first, not previously used)
  - Measure source player, destination slot in team 1 (middle of roster)
  - Set `--pdemo-*` CSS variables on container
  - Apply `.comp-player-demo-drag` to source player row
  - Apply `.comp-player-demo-shift-down` to team 1 players below insertion point
  - Apply `.comp-player-demo-shift-up` to the one player that swaps back during jiggle
  - Crossfade cursor from pointer → hand
  - Show thought bubble: "Where would you place this player?"
  - Wait for animation duration, then cleanup

- [ ] Implement Phase 4 (cleanup + repeat):
  - Remove all demo classes from DOM elements
  - Fade cursor and thought bubble
  - Add player to usedPlayers set (ref)
  - Start 15s idle timer — if no interaction, repeat from Phase 1 with new random player

- [ ] Implement stop-on-interaction:
  - `onUserInteraction` callback clears all timeouts, removes all demo classes, sets stopped flag
  - Cleanup function in useEffect for unmount

- [ ] Guard all setTimeout callbacks with `isMounted` ref to prevent stale updates

---

## Task 4: Wire into step-rank-players.tsx

**Files:** `app/(app)/home/step-rank-players.tsx`

- [ ] Add `useRef<HTMLDivElement>` wrapping the wizard-container
- [ ] Import and call `usePlayerRankDemo` hook
- [ ] Render cursor overlay inside the container (set position: relative on container):
  ```tsx
  {demoActive && (
    <div className="player-demo-cursor" style={{ transform: `translate(${cursorPos.x}px, ${cursorPos.y}px)` }}>
      <Pointer size={28} className={cursorType === "pointer" ? "visible" : ""} />
      <Hand size={28} className={cursorType === "hand" ? "visible" : ""} />
      {showLabel && (
        <div className="player-demo-label">
          Where would you place this player?
        </div>
      )}
    </div>
  )}
  ```
- [ ] Pass `demoExpandedTeams` and `onUserInteraction` to `TeamTierList`
- [ ] Import `Pointer` and `Hand` from lucide-react

---

## Task 5: Build + visual verification

- [ ] Run `npm run build` — no errors
- [ ] Run dev server, navigate to Step 2 (Rank Existing Players)
- [ ] Verify Phase 1: pointer appears, clicks opposite tab, switches, clicks back
- [ ] Verify Phase 2: pointer expands first two teams
- [ ] Verify Phase 3: cursor transitions to hand, grabs player from team 2, drags up into team 1 with thought bubble, shifts visible, returns
- [ ] Verify Phase 4: cleanup, 15s wait, repeat with different player
- [ ] Verify user drag stops demo immediately
- [ ] Commit

---

## CSS Variable Reference

All set dynamically by the hook based on DOM measurements:

| Variable | Purpose |
|----------|---------|
| `--pdemo-target-y` | Y offset from source player to insertion point in team 1 |
| `--pdemo-jiggle-y` | Y offset one row below target (nudge-down position) |
| `--pdemo-shift` | Height of one player row (~33px) for shift animations |

## Lucide Icons

- **Pointer** (`lucide-react`) — index finger, for clicking phases (1 & 2)
- **Hand** (`lucide-react`) — open palm, for grab/drag phase (3)
- Both rendered at size 28, white, with `filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4))` — matching existing team demo hand

## Key Design Decisions

- **Hybrid JS + CSS:** Phases 1-2 use JS setTimeout for real state changes (tab switch, team expand). Phase 3 uses CSS keyframes for smooth GPU-composited animation. CSS alone can't trigger React state changes; pure JS would be jankier for the drag.
- **Data attributes over props:** Player rows are nested inside TeamRow inside TeamTierList. Threading demo classes through props would pollute component interfaces. `[data-player-number="123"]` queries are simple and decoupled.
- **Hook architecture:** Demo needs to orchestrate state changes (tab switch, team expand) that live in the parent. A hook returns values and callbacks that integrate naturally with React's data flow.
- **`--pdemo-` prefix:** Avoids collision with existing team demo's `--demo-*` CSS variables.
- **TeamTierList mode="players":** In this mode, teams show chevrons (not grip handles), teams expand/collapse on click, players within teams are draggable. The demo leverages this — pointer clicks to expand, then hand grabs players.
