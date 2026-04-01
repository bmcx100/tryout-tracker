# IceSheet — Full App Implementation Plan

## Context

IceSheet has a landing page built with the Brutalist Signal design system. Now we need to build the actual app: a private, invite-only hockey tryout tracker for parents. Admin enters data (players, ice times, cuts), approved users track their kids through the tryout cascade (AA → A → BB → B → C). Backend is Supabase (Postgres + Google OAuth). This plan covers the complete build from auth through real-time updates.

---

## Route Architecture

```
app/
  layout.tsx                     ← modify (add AuthProvider)
  page.tsx                       ← keep (landing page)
  globals.css                    ← extend (add app view styles)
  not-found.tsx                  ← new (404)

  login/page.tsx                 ← new (Google sign-in)
  pending/page.tsx               ← new (awaiting approval)
  auth/callback/route.ts         ← new (OAuth callback)
  api/scrape/route.ts            ← new (URL scraping endpoint)

  (app)/                         ← route group (no URL segment)
    layout.tsx                   ← new (app shell: sidebar, header, tab bar, auth guard)
    schedule/page.tsx            ← new (default view — ice times)
    players/page.tsx             ← new (player roster)
    rounds/page.tsx              ← new (cut timeline)
    teams/page.tsx               ← new (roster fill status)
    admin/
      layout.tsx                 ← new (admin sub-nav)
      page.tsx                   ← new (dashboard)
      players/page.tsx           ← new (CRUD players)
      sessions/page.tsx          ← new (CRUD ice times)
      rounds/page.tsx            ← new (CRUD rounds + results)
      import/page.tsx            ← new (URL scrape + confirm)
      users/page.tsx             ← new (approve users, assign roles)
      corrections/page.tsx       ← new (review corrections)
```

---

## Phase 1: Foundation — Supabase, Auth, Database

### Step 1.1: Install Dependencies
```bash
npm install @supabase/supabase-js @supabase/ssr
```

### Step 1.2: Environment Variables
Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

### Step 1.3: Supabase Client Utilities
- `lib/supabase/client.ts` — browser client using `createBrowserClient` from `@supabase/ssr`
- `lib/supabase/server.ts` — server client using `createServerClient` (cookies via `next/headers`)
- `lib/supabase/middleware.ts` — `updateSession()` helper for token refresh

### Step 1.4: Next.js Middleware
- `middleware.ts` (project root)
- Refreshes auth session on every request
- Route guards:
  - `/login` → if authed, redirect to `/schedule`
  - App routes → if not authed, redirect to `/login`
  - App routes → if `pending` role, redirect to `/pending`
  - `/admin/*` → if not `admin` role, redirect to `/schedule`

### Step 1.5: Database Schema (SQL)

**profiles** — extends auth.users
- id (uuid, FK to auth.users), email, display_name, role (`pending`|`lite`|`full`|`admin`), created_at, approved_at
- Trigger: auto-create profile on auth.users insert

**players**
- id (uuid), number (int, unique), real_name, previous_team, previous_level
- entry_level, current_level (`AA`|`A`|`BB`|`B`|`C`)
- status (`active_tryout`|`cut_to_next_level`|`placed_on_team`|`withdrawn`)
- team_placed, created_at, updated_at

**sessions** (ice times)
- id, level, round_number, group_number (1-4), date, start_time, end_time, rink, notes

**session_players** (junction)
- session_id (FK), player_number (FK), composite PK

**rounds**
- id, level, round_number, date, notes, unique(level, round_number)

**round_results**
- id, round_id (FK), player_number (FK), result (`advanced`|`cut_down`|`withdrawn`|`placed`), notes

**user_annotations** (private per user — decoder ring)
- id, user_id (FK), player_number (FK), personal_name, notes, unique(user_id, player_number)

**user_watchlist** (private per user)
- id, user_id (FK), player_number (FK), unique(user_id, player_number)

**corrections**
- id, user_id (FK), player_number, entity_type (`player`|`session`|`round`), entity_id
- field, current_value, suggested_value, status (`pending`|`approved`|`rejected`), admin_notes

### Step 1.6: Row-Level Security

- `get_user_role()` helper function returns current user's role
- **profiles:** users read own, admins read/update all
- **players:** approved users (lite/full/admin) can SELECT, admins can INSERT/UPDATE/DELETE
- **sessions, session_players, rounds, round_results:** approved users SELECT, admins manage all
- **user_annotations, user_watchlist:** users manage own only (fully private)
- **corrections:** users INSERT/SELECT own, admins SELECT/UPDATE all

**Column-level security for real_name:**
- Create `players_view` Postgres view that returns `real_name` only when role is `full` or `admin`, NULL otherwise
- App always queries through this view

### Step 1.7: Auth Pages
- `app/login/page.tsx` — Google sign-in button, Brutalist Signal styled
- `app/auth/callback/route.ts` — exchanges OAuth code for session, redirects by role
- `app/pending/page.tsx` — "Awaiting Approval" holding page with sign-out

### Step 1.8: TypeScript Types
- `lib/types.ts` — all interfaces: Profile, Player, Session, Round, RoundResult, UserAnnotation, UserWatchlistItem, Correction, plus union types for roles/statuses/levels

### Step 1.9: Auth Context
- `components/providers/auth-provider.tsx` — client component, listens to `onAuthStateChange`, fetches profile, provides `user`, `profile`, `isLoading`, `signOut` via context
- `hooks/use-auth.ts` — re-export of useAuth hook

### Step 1.10: Update Root Layout
- Wrap children in `AuthProvider` in `app/layout.tsx`

**Verify:** Sign in with Google → land on `/pending` → manually set role to admin in Supabase → refresh → redirect to `/schedule`

---

## Phase 2: App Shell & Navigation

### Step 2.1: Install shadcn/ui Components
```bash
npx shadcn@latest add avatar badge card dialog dropdown-menu input label select separator sheet skeleton table tabs textarea toast tooltip popover scroll-area switch alert-dialog
```

### Step 2.2: App Layout
- `app/(app)/layout.tsx` — server component, verifies auth, fetches profile, renders shell:
  - `AppSidebar` (desktop), `AppHeaderAuth` (top), `AppTabBar` (mobile), `{children}`

### Step 2.3: Refactor Navigation for Real Routing
- `components/app-sidebar.tsx` — uses `<Link>` + `usePathname()` for active state. Nav: Schedule, Players, Rounds, Teams (+ Admin for admin role). Reuses existing `sidebar-*` CSS classes
- `components/app-tab-bar.tsx` — same pattern for mobile. Reuses `bottom-tab-bar` CSS
- `components/app-header-auth.tsx` — extends header with user avatar dropdown (name, role badge, sign-out)
- Keep existing landing page components (`sidebar-nav.tsx`, `bottom-tab-bar.tsx`) untouched for the marketing page

### Step 2.4: Pending Page
- Auto-polls or subscribes to own profile row — redirects when role changes from `pending`

### Step 2.5: App View CSS
- Extend `globals.css` with new sections: page headers, data tables, filter bars, player cards, session cards, status badges, watchlist highlights — all using existing Brutalist Signal tokens

**Verify:** Navigate between /schedule, /players, /rounds, /teams with working nav. Admin sees admin link.

---

## Phase 3: Admin Data Management

### Step 3.1: Admin Layout
- `app/(app)/admin/layout.tsx` — verifies admin role, renders sub-nav tabs (Dashboard, Players, Sessions, Rounds, Import, Users, Corrections)

### Step 3.2: Admin Dashboard
- `app/(app)/admin/page.tsx` — stats overview: total players, active per level, pending corrections, pending users. Quick action buttons.

### Step 3.3: Player CRUD
- `app/(app)/admin/players/page.tsx` — table with filters (level, status), search by number, add/edit via dialog, bulk status update for processing cuts
- `lib/actions/players.ts` — server actions: `createPlayer`, `updatePlayer`, `deletePlayer`, `bulkUpdatePlayerStatus`

### Step 3.4: Session CRUD
- `app/(app)/admin/sessions/page.tsx` — sessions grouped by level/round/group, create/edit via dialog, assign players to sessions via multi-select
- `lib/actions/sessions.ts` — server actions: `createSession`, `updateSession`, `deleteSession`, `assignPlayersToSession`

### Step 3.5: Round & Results CRUD
- `app/(app)/admin/rounds/page.tsx` — rounds by level, create round, enter results per player (advanced/cut_down/withdrawn/placed)
- `lib/actions/rounds.ts` — server actions: `createRound`, `recordRoundResults`
- `recordRoundResults` also updates players table: cut_down → move current_level down, withdrawn → set status, placed → set team_placed

### Step 3.6: User Management
- `app/(app)/admin/users/page.tsx` — list users by role, pending users at top with approve buttons (assign lite or full), change existing roles
- `lib/actions/users.ts` — server actions: `approveUser`, `updateUserRole`

**Verify:** Admin can CRUD players, sessions, rounds. Can approve users. Round results cascade player status correctly.

---

## Phase 4: User-Facing Views

### Step 4.1: Schedule View (default landing)
- `app/(app)/schedule/page.tsx` — fetches sessions + watchlist, groups by date
- Session cards: level badge, round/group, time, rink, player count, expandable player numbers (watchlisted highlighted in Signal red)
- Filter by level
- Components: `components/schedule/session-card.tsx`, `date-group.tsx`, `level-filter.tsx`

### Step 4.2: Players View
- `app/(app)/players/page.tsx` — fetches from `players_view` + annotations + watchlist
- Search by number, filter by level/status/previous team
- Cards: number (large mono), name (real if full, annotation if lite + italic), previous team, current level, status badge, watchlist star
- Click → player detail sheet with full history
- Components: `components/players/player-card.tsx`, `player-list.tsx`, `player-filters.tsx`, `player-detail-sheet.tsx`

### Step 4.3: Rounds View
- `app/(app)/rounds/page.tsx` — timeline of cuts by level
- Round cards: level + round header, date, summary (X advanced, Y cut), expandable results, watchlisted highlighted
- Components: `components/rounds/round-card.tsx`, `round-timeline.tsx`, `result-row.tsx`

### Step 4.4: Teams View
- `app/(app)/teams/page.tsx` — five level columns (AA through C)
- Each: level name, active count, fill rate ring (reuse MetricRing pattern), active players list, placed players list
- Components: `components/teams/level-card.tsx`, `level-roster.tsx`

**Verify:** All four views render with real data, filters work, watchlisted numbers highlighted, lite users don't see real names.

---

## Phase 5: Social Features

### Step 5.1: Watchlist
- `components/watchlist-star.tsx` — star toggle using `useOptimistic` for instant feedback
- `lib/actions/watchlist.ts` — `toggleWatchlist` server action

### Step 5.2: Annotations (Decoder Ring)
- `components/players/annotation-editor.tsx` — name + notes fields in player detail sheet, auto-save on blur
- `lib/actions/annotations.ts` — `upsertAnnotation`, `deleteAnnotation` server actions

### Step 5.3: Corrections
- `components/correction-form.tsx` — dialog for submitting corrections on player/session/round data
- `app/(app)/admin/corrections/page.tsx` — admin review table with approve/reject
- `lib/actions/corrections.ts` — `submitCorrection`, `resolveCorrection` (approve also updates the underlying data)

### Step 5.4: Toast Notifications
- `components/providers/toast-provider.tsx` — shadcn Toaster in app layout
- Feedback for: watchlist toggle, annotation save, correction submit/resolve

**Verify:** Star players, add annotations (private), submit corrections, admin resolves them.

---

## Phase 6: Real-Time Updates

### Step 6.1: Realtime Hook
- `hooks/use-realtime-table.ts` — subscribes to Supabase Realtime changes on a table, merges updates into local state

### Step 6.2: Apply to Views
- Schedule, Players, Rounds: server components fetch initial data, pass to client wrapper that subscribes for realtime updates
- Pending page: subscribe to own profile row for role changes

### Step 6.3: Polling Fallback
- `hooks/use-polling.ts` — poll every 30s when tab is visible, as fallback if Realtime has tier limits

**Verify:** Admin publishes data → users see updates within seconds without refresh.

---

## Phase 7: URL Scraping / Import

### Step 7.1: Scrape Endpoint
- `app/api/scrape/route.ts` — POST with URL, fetches page HTML, parses player numbers + ice time assignments
- `lib/scraper/parser.ts` — HTML parsing with `cheerio` (`npm install cheerio`), returns structured `ScrapedSession[]`
- Parser is specific to league website format, designed as swappable module

### Step 7.2: Import UI
- `app/(app)/admin/import/page.tsx` — 4-step wizard:
  1. Paste URL → Fetch
  2. Preview parsed data (green=existing numbers, yellow=new numbers, red=errors)
  3. Admin edits/confirms
  4. Result summary
- Components: `components/admin/import-wizard.tsx`, `import-preview.tsx`, `import-result.tsx`
- `lib/actions/import.ts` — `scrapeUrl`, `confirmImport` server actions

### Step 7.3: Manual Fallback
- Import page has "Manual Entry" tab linking to session creation form (Phase 3)

**Verify:** Paste URL → see parsed data → confirm → sessions appear in schedule.

---

## Phase 8: Polish

### Step 8.1: Loading States
- `loading.tsx` for each app route using shadcn Skeleton components

### Step 8.2: Error Boundaries
- `error.tsx` for each app route with Brutalist Signal styled error + retry button

### Step 8.3: Empty States
- System-style messages in Space Mono/Steel when no data exists

### Step 8.4: Mobile Optimizations
- Tables → card layouts on mobile
- Dialogs → full-screen sheets on mobile
- Touch-friendly star toggles

### Step 8.5: 404 Page
- `app/not-found.tsx` in Brutalist Signal style

---

## New Dependencies

**Runtime:** `@supabase/supabase-js`, `@supabase/ssr`, `cheerio` (Phase 7 only)
**shadcn/ui:** avatar, badge, card, dialog, dropdown-menu, input, label, select, separator, sheet, skeleton, table, tabs, textarea, toast, tooltip, popover, scroll-area, switch, alert-dialog

---

## New File Tree

```
lib/
  supabase/client.ts, server.ts, middleware.ts
  types.ts
  actions/players.ts, sessions.ts, rounds.ts, users.ts, watchlist.ts, annotations.ts, corrections.ts, import.ts
  scraper/parser.ts
middleware.ts
hooks/use-auth.ts, use-realtime-table.ts, use-polling.ts
components/
  providers/auth-provider.tsx, toast-provider.tsx
  app-sidebar.tsx, app-tab-bar.tsx, app-header-auth.tsx
  watchlist-star.tsx, correction-form.tsx
  schedule/session-card.tsx, date-group.tsx, level-filter.tsx
  players/player-card.tsx, player-list.tsx, player-filters.tsx, player-detail-sheet.tsx, annotation-editor.tsx
  rounds/round-card.tsx, round-timeline.tsx, result-row.tsx
  teams/level-card.tsx, level-roster.tsx
  admin/import-wizard.tsx, import-preview.tsx, import-result.tsx
app/
  login/page.tsx
  pending/page.tsx
  auth/callback/route.ts
  api/scrape/route.ts
  not-found.tsx
  (app)/layout.tsx, schedule/*, players/*, rounds/*, teams/*, admin/**
```

---

## Verification

After each phase, run:
1. `npm run build` — confirms no TypeScript/build errors
2. `npm run lint` — confirms no lint issues
3. Manual test flow:
   - Phase 1: Google login → pending → admin approves → access granted
   - Phase 2: Navigate all routes, verify nav active states
   - Phase 3: Admin creates players/sessions/rounds, records results
   - Phase 4: View schedule/players/rounds/teams with real data
   - Phase 5: Star players, annotate, submit/resolve corrections
   - Phase 6: Admin updates data, user sees changes in real-time
   - Phase 7: Paste league URL, preview, confirm import
   - Phase 8: Loading skeletons, error states, empty states, 404
