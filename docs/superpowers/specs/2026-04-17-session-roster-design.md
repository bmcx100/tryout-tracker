# Session Card Roster Display

## Summary

Show the full player roster under each upcoming session card on the Tryouts page. Each row displays jersey number, player name, and previous team. Crew members are highlighted with a red left border.

## Current Behavior

Session cards show: level badge, round/group, time, rink, and crew highlight badges (red badges showing only tracked players). Non-crew players are invisible.

## New Behavior

Replace crew highlight badges with a full roster list. Every player assigned to the session via `session_players` is shown in a single-column list sorted by jersey number.

### Roster row format

```
#number  Name          previous_team
#3       M. Chen       U15AA
#14      R. Bailey     U13AA    ← crew member (red highlight)
#22      S. Lopez      U13AA
```

- **Jersey number**: bold, fixed-width
- **Name**: from `players_view` (respects RLS — lite users see fallback `#number` only)
- **Previous team**: gray, right-aligned (e.g. "U13AA", "U15A")
- **Crew highlight**: red left border + red text on the row

### Header

Label above the roster: "18 Players" (count of assigned players).

## Data Flow

No new database queries. All data is already fetched on `/current`:

1. `session_players` — which player numbers belong to each session
2. `players_view` — player details (name, previous_team)
3. `user_crew` — which players the user tracks

### Build roster per session

```
playerMap = Map<number, Player>  // from players_view
crewSet = Set<number>            // from user_crew

For each session:
  playerNumbers = session_players for this session_id
  roster = playerNumbers
    .map(num => ({ ...playerMap.get(num), isCrew: crewSet.has(num) }))
    .sort by jersey number
```

Pass `roster` to `SessionCard` instead of `crewHighlights`.

## Components Changed

### `app/(app)/current/page.tsx`
- Build `playerMap` (number → Player) and `crewSet` (Set of crew numbers)
- Map sessions to include `roster` array instead of `crewHighlights`
- Update `SessionWithCrew` interface → `SessionWithRoster`

### `components/schedule/session-card.tsx`
- Replace `crewHighlights` prop with `roster` prop
- Remove crew badge rendering
- Add roster list: label + single-column player rows
- Crew rows get `.session-roster-crew` class

### `components/current/rounds-tab.tsx`
- Update interface and prop passing to match new roster shape

### `app/globals.css`
- `.session-roster` — container with top border separator
- `.session-roster-label` — "18 Players" header (uppercase, small, steel color)
- `.session-roster-row` — flex row: number + name + previous_team
- `.session-roster-crew` — red left border + red text variant

## Edge Cases

- **No players assigned**: Hide roster section entirely (same as current behavior with no crew)
- **Lite users**: `first_name`/`last_name` are null from `players_view` — `playerName()` falls back to `#number`
- **Missing previous_team**: Show nothing in that column (some players may not have it)
- **Player in session_players but not in players_view**: Skip (data integrity issue, shouldn't happen)

## Out of Scope

- Expandable/collapsible roster (user chose always-visible)
- Position grouping within the roster
- Showing roster on admin session cards
