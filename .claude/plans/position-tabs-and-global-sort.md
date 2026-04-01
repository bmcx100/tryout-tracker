# Plan: Position Tabs + Global Team Order + Defense Separation

## Summary of Changes

1. Add Forwards/Defense/Goalies/All position tabs to the **Rank Existing Teams** step (above Reset button, default to Forwards)
2. Move position tabs in **Expected Teams** to above the Re-Sort/Reset toolbar (default to Forwards)
3. Visually separate defense players from forwards/goalies when "All" is selected (both views)
4. Unify team order storage — one global `team_order`, not per-position
5. Keep expected-teams customizations (player reorders, slots, pinned players) per-position

---

## Detailed Changes

### 1. Position Tabs on Rank Step (`step-rank-teams.tsx`)

**What:** Add the same Forwards/Defense/Goalies/All tab bar that exists in `results-view.tsx`, placed above the Reset button.

**New props needed:**
- `positionGroup: PositionGroup` — current active tab
- `onSwitchPosition: (group: PositionGroup) => void` — tab click handler

**Layout order:**
1. Headline: "Rank existing teams"
2. Subtext
3. **Position tabs** (new)
4. Reset button toolbar
5. TeamTierList
6. Next button

**Filtering behavior:** When a position is selected (F/D/G), the `PlayerList` inside each team only shows players of that position. When "All" is selected, all players show (with defense separation — see item 3). The **team list itself** is always the same (global order) regardless of position tab.

**Default:** Forwards (`activeGroup` already defaults to `"forwards"` in `page.tsx`)

---

### 2. Move Position Tabs in Expected Teams (`results-view.tsx`)

**What:** Move the `results-position-tabs` div to ABOVE the `results-toolbar` (Re-Sort / Reset buttons).

**Current order:**
1. Header
2. Toolbar (Re-Sort + Reset)
3. Position tabs
4. ResultingTeamsDnd

**New order:**
1. Header
2. **Position tabs**
3. Toolbar (Re-Sort + Reset)
4. ResultingTeamsDnd

**Default:** Already defaults to whatever `activeGroup` is set to — which will be `"forwards"`.

---

### 3. Defense Separation in "All" View

**What:** When position tab is set to "All", defense players should be visually distinguished from forwards and goalies in both the rank step and expected teams.

**Approach — Rank Step (`player-list.tsx`):**
- When rendering "All" players within a team, insert a visual separator/divider between position groups (F→D and D→G boundaries)
- The `PlayerList` component sorts by position order (F=0, D=1, G=2) then by number — so defense players are already grouped together
- Add a thin border-top or spacing gap before the first D player and after the last D player
- Could use a CSS class on defense player cards (e.g., `.comp-player-defense`) or insert a divider element between position groups

**Approach — Expected Teams (`resulting-teams-dnd.tsx`):**
- The `DraggablePlayerRow` already conditionally adds `comp-nt-defense` class for D players (line 151)
- Need to make that class more visually distinct (currently might not have strong styling)
- When "ALL" is selected and a team is expanded, insert visual dividers between F/D/G groups
- Add a subtle background tint or left-border accent for defense rows
- Add a small position group label ("Defense") before the first D player in each team

**CSS additions in `globals.css`:**
- `.comp-player-defense` or `.comp-nt-defense` — subtle background shift, left border accent, or spacing
- `.position-divider` — thin line or gap between position groups
- Consider a slightly different background for defense rows (e.g., a faint blue-gray tint against the paper background)

---

### 4. Global Team Order Storage

**Current model:** Each `user_competition_prefs` row (per position_group) has its own `team_order[]`. When switching to a new position with no prefs, it inherits from the most recent sort.

**New model:** Team order is **global** — one order used across all position groups for the rank step. The rank step always shows and edits this single global order.

**Implementation:**

#### a. Database: Add a `position_group = 'global'` row concept
- Store the single team order in a prefs row with `position_group = 'global'`
- OR (simpler) just always read/write team_order from the `'forwards'` row and treat it as the canonical source
- **Recommended:** Use a dedicated `'global'` position_group value. This avoids confusion and doesn't require changing the PositionGroup type much.

#### b. `page.tsx` changes:
- On load: fetch the `'global'` prefs row for `team_order`. Fetch per-position rows for `player_order`, `pinned_players`, `team_slots`.
- `handleTeamReorder`: always writes to `position_group = 'global'`
- `handleSwitchPosition` in rank step: changing position tab does NOT change `team_order` — it only filters which players are visible
- `handleSwitchPosition` in results view: loads per-position `player_order`, `pinned_players`, `team_slots` while keeping the global `team_order`

#### c. `lib/types.ts`:
- Add `'global'` to `PositionGroup` type: `type PositionGroup = "all" | "forwards" | "defense" | "goalies" | "global"`
- OR keep PositionGroup as-is for UI tabs and use a separate type for storage

#### d. Server actions (`competition-prefs.ts`):
- `updateTeamOrder` always uses `position_group = 'global'`
- `updatePlayerOrder`, `pinPlayer`, `updateTeamSlots` continue using per-position group
- `resetPrefs` needs to handle global vs per-position resets differently

#### e. State management in `page.tsx`:
- Separate state: `globalTeamOrder: string[]` (the one ranking) and `currentPrefs` (per-position customizations)
- `handleTeamReorder` updates `globalTeamOrder` and persists to `'global'` row
- Position tab switches in rank step only change player filtering, not the team order
- Position tab switches in results view load per-position `player_order`/`pinned_players`/`team_slots`

---

### 5. Per-Position Expected Team Customizations

**What stays per-position:**
- `player_order` (the `rt:` prefixed keys — custom player ordering within resulting teams)
- `pinned_players` (players manually moved between teams in rank step, per position)
- `team_slots` (custom F/D/G counts per resulting team)

**What becomes global:**
- `team_order` (the ranking of existing teams, used to compute initial player rankings)

**Behavior when switching positions in results view:**
- If position has saved prefs → load its `player_order`, `pinned_players`, `team_slots`
- If no saved prefs for position → use empty defaults (no player overrides, no custom slots, no pins)
- Team order always comes from the global source
- This means the initial computed assignments use the global team order, and any manual overrides are per-position

---

## Files to Modify

| File | Changes |
|------|---------|
| `app/(app)/home/page.tsx` | Split state into global team order + per-position prefs. Update handlers. Pass position filter to StepRankTeams. |
| `app/(app)/home/step-rank-teams.tsx` | Add position tabs UI above reset. Accept `positionGroup` + `onSwitchPosition` props. |
| `app/(app)/home/results-view.tsx` | Move position tabs above toolbar. |
| `components/competition/player-list.tsx` | Accept `positionFilter` prop. Filter players by position. Add defense dividers when showing "All". |
| `components/competition/player-card.tsx` | Add defense CSS class when player is D position. |
| `components/competition/resulting-teams-dnd.tsx` | Add position group dividers/labels when position="ALL" inside DroppableTeam. |
| `lib/types.ts` | Possibly extend PositionGroup or add storage type. |
| `lib/actions/competition-prefs.ts` | Update `updateTeamOrder` to always target `'global'`. Add migration logic or new load pattern. |
| `app/globals.css` | Add defense separator styles, position divider styles. |

---

## Migration / Backwards Compatibility

- Existing users may have per-position `team_order` values stored
- On first load, if no `'global'` prefs row exists, create one from the most recent position's `team_order`
- Existing per-position `player_order`, `pinned_players`, `team_slots` continue to work as-is

---

## Edge Cases

- **First-time user:** No prefs at all → rank step shows with DEFAULT_TEAM_ORDER, position tabs default to Forwards
- **User with only forwards sorted:** Global team order exists (from forwards). Switching to defense in results shows computed results using that global order with no customizations.
- **Reset in rank step:** Resets global team order to default. Should NOT clear per-position customizations in expected teams.
- **Reset in results view:** Resets the current position's customizations (player_order, pinned_players, team_slots) but NOT the global team order.
