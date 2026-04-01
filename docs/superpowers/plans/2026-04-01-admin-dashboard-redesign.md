# Admin Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-card admin dashboard with a 4-card dashboard (Players, Teams, Active Sessions, Users) showing richer operational metrics with progress bars and sub-stats.

**Architecture:** Single server component (`app/(app)/admin/page.tsx`) fetches all data via Supabase queries in `Promise.all`, computes derived stats, renders 4 stat cards. New CSS classes in `globals.css` following existing `admin-stat-*` naming. No new files — just modifying the existing page and stylesheet.

**Tech Stack:** Next.js 16 server component, Supabase JS client, Tailwind v4 with `@apply`

**Spec:** `docs/superpowers/specs/2026-04-01-admin-dashboard-redesign.md`

---

### Task 1: Pull latest CSS changes and create feature branch

**Files:**
- None (git operations only)

- [ ] **Step 1: Pull latest from main**

```bash
git pull origin main
```

- [ ] **Step 2: Create feature branch**

```bash
git switch -c feat/admin-dashboard-redesign
```

- [ ] **Step 3: Verify clean state**

```bash
git status
```

Expected: clean working tree on `feat/admin-dashboard-redesign`

---

### Task 2: Add CSS classes for new dashboard cards

**Files:**
- Modify: `app/globals.css` (after the existing `.admin-stat-label` block, around line 1749)

- [ ] **Step 1: Replace existing admin stat CSS classes**

Replace the existing `.admin-stat-card`, `.admin-stat-value`, and `.admin-stat-label` classes with the new set. Find these classes (around lines 1731–1749) and replace them with:

```css
.admin-stat-card {
  @apply bg-paper;
  padding: 14px;
  border-radius: 0.25rem;
  border: 2px solid rgba(17, 17, 17, 0.12);
}

.admin-stat-header {
  @apply flex justify-between items-baseline;
}

.admin-stat-label {
  @apply font-data uppercase text-steel;
  font-size: 11px;
  letter-spacing: 0.1em;
}

.admin-stat-value {
  @apply font-heading font-bold text-ink;
  font-size: 28px;
  line-height: 1;
}

.admin-stat-substats {
  margin-top: 10px;
}

.admin-stat-row {
  @apply flex justify-between font-data text-steel;
  font-size: 12px;
  margin-bottom: 4px;
}

.admin-stat-row--alert {
  @apply text-signal;
}

.admin-stat-divider {
  border-top: 1px solid rgba(17, 17, 17, 0.08);
  padding-top: 6px;
  margin-top: 4px;
}

.admin-progress {
  @apply bg-ash;
  height: 5px;
  border-radius: 3px;
  overflow: hidden;
}

.admin-progress-fill {
  @apply bg-ink;
  height: 100%;
  transition: width 0.3s ease;
}

.admin-progress-fill--alert {
  @apply bg-signal;
}

.admin-progress-row {
  margin-bottom: 8px;
}

.admin-progress-row:last-child {
  margin-bottom: 0;
}

.admin-progress-label {
  @apply flex justify-between font-data text-steel;
  font-size: 11px;
  margin-bottom: 3px;
}
```

- [ ] **Step 2: Verify the dev server still compiles**

Run: `npm run dev` (check for CSS parse errors in terminal)
Expected: compiles without errors

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "style: add CSS classes for redesigned admin dashboard cards"
```

---

### Task 3: Rewrite admin dashboard with Players and Teams cards

**Files:**
- Modify: `app/(app)/admin/page.tsx`

- [ ] **Step 1: Replace the full contents of `app/(app)/admin/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server"

interface TeamStats {
  total: number
  fullyConfirmed: number
  allCheckedIn: number
}

function computeTeamStats(
  players: { previous_team: string | null, info_confirmed: boolean, checked_in: boolean }[]
): TeamStats {
  const teams = new Map<string, { confirmed: boolean, checkedIn: boolean }>()

  for (const p of players) {
    const team = p.previous_team ?? "Unknown"
    const existing = teams.get(team)
    if (!existing) {
      teams.set(team, { confirmed: p.info_confirmed, checkedIn: p.checked_in })
    } else {
      if (!p.info_confirmed) existing.confirmed = false
      if (!p.checked_in) existing.checkedIn = false
    }
  }

  let fullyConfirmed = 0
  let allCheckedIn = 0
  for (const t of teams.values()) {
    if (t.confirmed) fullyConfirmed++
    if (t.checkedIn) allCheckedIn++
  }

  return { total: teams.size, fullyConfirmed, allCheckedIn }
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const [
    { count: playerCount },
    { count: confirmedCount },
    { count: checkedInCount },
    { data: teamPlayers },
    { count: userCount },
    { count: pendingUserCount },
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("info_confirmed", true),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("checked_in", true),
    supabase.from("players").select("previous_team, info_confirmed, checked_in"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pending"),
  ])

  const totalPlayers = playerCount ?? 0
  const totalConfirmed = confirmedCount ?? 0
  const totalCheckedIn = checkedInCount ?? 0
  const teamStats = computeTeamStats(teamPlayers ?? [])
  const totalUsers = userCount ?? 0
  const totalPending = pendingUserCount ?? 0
  const totalActive = totalUsers - totalPending

  return (
    <div>
      <h1 className="app-page-title">Admin Dashboard</h1>
      <div className="admin-stats">
        {/* Players Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Total Players</div>
            <div className="admin-stat-value">{totalPlayers}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>Info Confirmed</span>
                <span>{totalConfirmed}/{totalPlayers}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill"
                  style={{ width: totalPlayers > 0 ? `${(totalConfirmed / totalPlayers) * 100}%` : "0%" }}
                />
              </div>
            </div>
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>Checked In</span>
                <span>{totalCheckedIn}/{totalPlayers}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill admin-progress-fill--alert"
                  style={{ width: totalPlayers > 0 ? `${(totalCheckedIn / totalPlayers) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Teams Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Teams</div>
            <div className="admin-stat-value">{teamStats.total}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>Fully Confirmed</span>
                <span>{teamStats.fullyConfirmed}/{teamStats.total}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill"
                  style={{ width: teamStats.total > 0 ? `${(teamStats.fullyConfirmed / teamStats.total) * 100}%` : "0%" }}
                />
              </div>
            </div>
            <div className="admin-progress-row">
              <div className="admin-progress-label">
                <span>All Checked In</span>
                <span>{teamStats.allCheckedIn}/{teamStats.total}</span>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress-fill admin-progress-fill--alert"
                  style={{ width: teamStats.total > 0 ? `${(teamStats.allCheckedIn / teamStats.total) * 100}%` : "0%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sessions Card — placeholder, implemented in Task 4 */}

        {/* Users Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Users</div>
            <div className="admin-stat-value">{totalUsers}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-stat-row">
              <span>Active</span>
              <span>{totalActive}</span>
            </div>
            <div className="admin-stat-row admin-stat-row--alert">
              <span>Pending Approval</span>
              <span>{totalPending}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`, navigate to `/admin`
Expected: 3 cards visible (Players with progress bars, Teams with progress bars, Users with sub-stats). No Sessions card yet.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/admin/page.tsx
git commit -m "feat: add Players, Teams, and Users cards to admin dashboard"
```

---

### Task 4: Add Active Sessions card with completion logic

**Files:**
- Modify: `app/(app)/admin/page.tsx`

- [ ] **Step 1: Add the session stats computation function**

Add this function after the existing `computeTeamStats` function (before `export default`):

```tsx
interface SessionStats {
  missingResults: number
  upcoming: number
  completed: number
}

function computeSessionStats(
  sessions: { level: string, round_number: number, date: string }[],
  rounds: { level: string, round_number: number, hasResults: boolean }[]
): SessionStats {
  const today = new Date().toISOString().split("T")[0]
  const roundMap = new Map<string, boolean>()
  for (const r of rounds) {
    roundMap.set(`${r.level}-${r.round_number}`, r.hasResults)
  }

  let missingResults = 0
  let upcoming = 0
  let completed = 0

  for (const s of sessions) {
    if (s.date >= today) {
      upcoming++
    } else {
      const key = `${s.level}-${s.round_number}`
      if (roundMap.get(key)) {
        completed++
      } else {
        missingResults++
      }
    }
  }

  return { missingResults, upcoming, completed }
}
```

- [ ] **Step 2: Add session and round queries to the `Promise.all`**

Replace the existing `Promise.all` block in `AdminDashboard` with:

```tsx
  const [
    { count: playerCount },
    { count: confirmedCount },
    { count: checkedInCount },
    { data: teamPlayers },
    { data: sessions },
    { data: rounds },
    { count: userCount },
    { count: pendingUserCount },
  ] = await Promise.all([
    supabase.from("players").select("*", { count: "exact", head: true }),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("info_confirmed", true),
    supabase.from("players").select("*", { count: "exact", head: true }).eq("checked_in", true),
    supabase.from("players").select("previous_team, info_confirmed, checked_in"),
    supabase.from("sessions").select("level, round_number, date"),
    supabase.from("rounds").select("level, round_number, round_results(id)"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "pending"),
  ])
```

- [ ] **Step 3: Compute session stats**

Add this line after the `teamStats` computation:

```tsx
  const roundsWithResults = (rounds ?? []).map((r: { level: string, round_number: number, round_results: { id: string }[] }) => ({
    level: r.level,
    round_number: r.round_number,
    hasResults: r.round_results.length > 0,
  }))
  const sessionStats = computeSessionStats(sessions ?? [], roundsWithResults)
```

- [ ] **Step 4: Add the Sessions card JSX**

Replace the `{/* Sessions Card — placeholder, implemented in Task 4 */}` comment with:

```tsx
        {/* Sessions Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-header">
            <div className="admin-stat-label">Active Sessions</div>
            <div className="admin-stat-value">{sessionStats.missingResults + sessionStats.upcoming}</div>
          </div>
          <div className="admin-stat-substats">
            <div className="admin-stat-row admin-stat-row--alert">
              <span>Missing Results</span>
              <span>{sessionStats.missingResults}</span>
            </div>
            <div className="admin-stat-row">
              <span>Upcoming</span>
              <span>{sessionStats.upcoming}</span>
            </div>
            <div className="admin-stat-row admin-stat-divider">
              <span>Completed</span>
              <span>{sessionStats.completed}</span>
            </div>
          </div>
        </div>
```

- [ ] **Step 5: Verify in browser**

Run: `npm run dev`, navigate to `/admin`
Expected: All 4 cards visible — Players, Teams, Active Sessions (with missing results/upcoming/completed breakdown), Users

- [ ] **Step 6: Commit**

```bash
git add app/(app)/admin/page.tsx
git commit -m "feat: add Active Sessions card with completion tracking"
```

---

### Task 5: Build check and final verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run the linter**

```bash
npm run lint
```

Expected: no errors related to admin page

- [ ] **Step 2: Run a production build**

```bash
npm run build
```

Expected: builds successfully, no type errors

- [ ] **Step 3: Fix any lint or build errors if found, then commit fixes**

If there are errors, fix them and:

```bash
git add -A
git commit -m "fix: resolve lint/build errors in admin dashboard"
```

- [ ] **Step 4: Final visual check**

Run: `npm run dev`, navigate to `/admin`
Verify:
- Players card: big number top-right, label top-left, two progress bars below
- Teams card: same layout with team-level aggregation progress bars
- Active Sessions card: big number = missing + upcoming, three text rows (missing in red, upcoming, divider, completed)
- Users card: big number = total including pending, active count, pending in red
- Mobile layout: all cards stack full-width
