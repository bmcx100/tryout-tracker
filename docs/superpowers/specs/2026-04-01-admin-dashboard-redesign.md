# Admin Dashboard Redesign

## Summary

Replace the current 3-card admin dashboard (Total Players, Pending Corrections, Pending Users) with a 4-card dashboard providing richer operational metrics. Full-width stacked layout (mobile-first). No changes to other admin pages.

## Cards

### 1. Total Players

- **Big number:** Count of all players in the `players` table
- **Sub-stats with progress bars:**
  - Info Confirmed — `X/total` where X = count of `info_confirmed = true`
  - Checked In — `X/total` where X = count of `checked_in = true`
- Progress bar colors: black (#111) for confirmed, signal red (#E63B2E) for checked in

### 2. Teams

- **Big number:** Count of distinct `previous_team` values across all players
- **Sub-stats with progress bars:**
  - Fully Confirmed — `X/total` where X = teams where ALL players have `info_confirmed = true`
  - All Checked In — `X/total` where X = teams where ALL players have `checked_in = true`
- Same progress bar color scheme as Players

### 3. Active Sessions

- **Big number:** Count of sessions that are not yet completed (missing results + upcoming)
- **Sub-stats (text rows, no progress bars):**
  - Missing Results — count of past sessions (date < today) whose round has no `round_results` entries (shown in signal red)
  - Upcoming — count of future sessions (date >= today)
  - _(divider)_
  - Completed — count of past sessions whose round has `round_results` entries

**Logic for session status:**
- A session's round is identified by matching `sessions.level` + `sessions.round_number` to `rounds.level` + `rounds.round_number`
- A session is "completed" if its date has passed AND its corresponding round has at least one `round_results` entry
- A session is "missing results" if its date has passed AND its round has NO `round_results` entries (or no matching round exists)
- A session is "upcoming" if its date is today or in the future

### 4. Users

- **Big number:** Total count of all profiles (including pending)
- **Sub-stats (text rows):**
  - Active — count of profiles where `role != 'pending'`
  - Pending Approval — count of profiles where `role = 'pending'` (shown in signal red)

## Layout

- Mobile-first full-width stack (single column, cards stacked vertically)
- Each card: label top-left, big number top-right, sub-stats below
- 12px gap between cards
- Cards use existing Brutalist Signal styling: Paper background, 2px border at 12% opacity, 4px (0.5rem max) border radius
- Progress bars: 5px height, Ash (#D4CFC6) track, colored fill, 3px border radius

## What's Removed

- **Pending Corrections card** — dropped from dashboard (still accessible from Corrections page in admin nav)

## What's NOT Changing

- No changes to `globals.css` until the other Claude Code instance commits and pushes its current work
- No changes to other admin pages (players, teams, sessions, rounds, corrections, users, import)
- No changes to the admin layout or navigation
- No new database tables or columns — all data derived from existing schema

## Data Queries

All queries run server-side in the admin page component (async server component, same pattern as current):

1. **Players total:** `supabase.from("players").select("*", { count: "exact", head: true })`
2. **Players confirmed:** `supabase.from("players").select("*", { count: "exact", head: true }).eq("info_confirmed", true)`
3. **Players checked in:** `supabase.from("players").select("*", { count: "exact", head: true }).eq("checked_in", true)`
4. **Teams aggregation:** Fetch all players with `select("previous_team, info_confirmed, checked_in")`, group client-side by `previous_team`, compute fully-confirmed and all-checked-in counts
5. **Sessions + completion status:** Fetch all sessions and all rounds with their result counts, compute status client-side
6. **Users total:** `supabase.from("profiles").select("*", { count: "exact", head: true })`
7. **Users pending:** `supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pending")`

Queries 1-3 and 6-7 run in parallel via `Promise.all`. Query 4 is a single fetch + client-side grouping. Query 5 requires joining sessions with rounds/results.

## CSS Classes to Add (in globals.css)

New classes following existing `admin-stat-*` naming convention:

- `.admin-stat-card` — update existing to support the new layout (label + number on same row)
- `.admin-stat-header` — flex row for label + big number
- `.admin-stat-substats` — container for sub-stat rows
- `.admin-stat-row` — flex row for label + value in sub-stats
- `.admin-stat-row--alert` — signal red variant
- `.admin-stat-divider` — subtle separator line
- `.admin-progress` — progress bar track
- `.admin-progress-fill` — progress bar fill (default black)
- `.admin-progress-fill--alert` — signal red fill variant
