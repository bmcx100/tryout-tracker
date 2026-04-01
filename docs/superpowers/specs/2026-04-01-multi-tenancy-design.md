# Multi-Tenancy Design — Cabot Tryout Crew Tracker

**Date:** 2026-04-01
**Approach:** Column-Level Tenancy (org_id on every data table)
**Goal:** Support multiple hockey associations (e.g., Nepean Wildcats, Ottawa Ice) with full data isolation, per-org admins, and a global super-admin.

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| User-to-org relationship | Multi-org per user |
| Role system | Per-org roles (via org_members) |
| Super-admin | Boolean flag on profiles |
| Player identity | Org-scoped numbers — (org_id, number) composite unique |
| Org creation | Super-admin only |
| Crew scope | Per-org (crew is scoped to active org) |
| Org switching UX | Dropdown in profile badge, navigate to home on switch |
| User onboarding | Invite link + QR code per org |

---

## 1. Data Model

### New Tables

#### organizations

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| name | text | NOT NULL — e.g., "Nepean Wildcats", "Ottawa Ice" |
| slug | text | UNIQUE, NOT NULL — e.g., "nepean-wildcats", "ottawa-ice" |
| created_at | timestamptz | DEFAULT now() |

#### org_members

Replaces the `role` column on profiles. One row per user per org.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| org_id | uuid | FK → organizations(id) |
| user_id | uuid | FK → profiles(id) |
| role | text | CHECK (pending, lite, full, admin) |
| approved_at | timestamptz | NULL — set when admin approves |
| created_at | timestamptz | DEFAULT now() |

**UNIQUE (org_id, user_id)** — one membership per org per user.

### Modified Tables

#### profiles — simplified

| Change | Details |
|--------|---------|
| ADD | `is_super_admin` boolean DEFAULT false |
| ADD | `active_org_id` uuid FK → organizations(id), NULL |
| REMOVE | `role` — moved to org_members |
| REMOVE | `approved_at` — moved to org_members |

#### All data tables — add org_id

Every data table gets an `org_id` column (uuid FK → organizations). Unique constraints change to include org_id:

| Table | New unique constraint |
|-------|----------------------|
| players | (org_id, number) replaces (number) |
| rounds | (org_id, level, round_number) replaces (level, round_number) |
| user_crew | (org_id, user_id, player_number) replaces (user_id, player_number) |
| user_competition_prefs | (org_id, user_id, position_group) replaces (user_id, position_group) |
| user_scenarios | (org_id, user_id, name) replaces (user_id, name) |

Tables that get org_id without unique constraint changes:
- sessions
- session_players
- round_results
- corrections

### Migration Strategy (Existing Data)

1. Create `organizations` table
2. Insert "Nepean Wildcats" org row
3. Add `org_id` column (nullable) to all data tables
4. Backfill: set `org_id = wildcats_id` on ALL existing rows
5. Create `org_members` table
6. Migrate existing profile roles → org_members rows (one per user, org = wildcats)
7. Add `is_super_admin` and `active_org_id` to profiles
8. Set `active_org_id = wildcats_id` for all existing users
9. Add NOT NULL constraint on org_id columns
10. Drop `role` and `approved_at` from profiles
11. Update unique constraints to include org_id
12. Rewrite all RLS policies

---

## 2. RLS Policies & Auth

### Core Helper Functions (PostgreSQL)

```
get_active_org_id()
  → Returns current user's active_org_id from profiles
  → Used by all RLS policies to scope data

get_org_role(org_id)
  → Returns user's role in a specific org from org_members
  → Used for permission checks (admin vs lite vs full)

is_super_admin()
  → Returns profiles.is_super_admin for current user
  → Super-admins bypass org scoping
```

### RLS Policy Pattern

**Data tables (players, sessions, rounds, round_results, session_players):**

- SELECT: `org_id = get_active_org_id() AND get_org_role(org_id) IN ('lite','full','admin')` OR `is_super_admin()`
- INSERT/UPDATE/DELETE: `org_id = get_active_org_id() AND get_org_role(org_id) = 'admin'` OR `is_super_admin()`

**user_crew, user_scenarios, user_competition_prefs (per-user tables):**

- SELECT: `user_id = auth.uid() AND org_id = get_active_org_id()`
- INSERT: `user_id = auth.uid() AND org_id = get_active_org_id() AND get_org_role(org_id) IN ('lite','full','admin')`
- UPDATE/DELETE: `user_id = auth.uid() AND org_id = get_active_org_id()`

**org_members:**

- SELECT (own): `user_id = auth.uid()`
- SELECT (admin): `get_org_role(org_id) = 'admin'` OR `is_super_admin()`
- INSERT/UPDATE: `get_org_role(org_id) = 'admin'` OR `is_super_admin()`

**organizations:**

- SELECT: user has at least one org_members row for that org, OR `is_super_admin()`
- INSERT/UPDATE/DELETE: `is_super_admin()` only

### players_view Update

The existing `players_view` that hides names from lite users must become org-aware:
- Check `get_org_role(players.org_id)` instead of the old `get_user_role()`
- lite in that org → hide names
- full/admin in that org → show names
- super_admin → show names

### Auth Flow

**New user signup:**
1. Google OAuth → `handle_new_user()` trigger creates profile (no role, no org, `active_org_id = NULL`). Note: the existing trigger must be updated to stop setting `role`.
2. User lands on `/pending` page
3. Org admin approves → creates `org_members` row with role
4. Sets user's `active_org_id` to that org
5. User refreshes → middleware sees membership → allows access

**Existing user joining a second org:**
1. User clicks `/join/ottawa-ice` invite link
2. Already authenticated → creates `org_members` row (role = "pending") for Ottawa Ice
3. Does NOT change `active_org_id` — user stays in their current org
4. Ottawa Ice admin approves → user can now switch to Ottawa Ice via profile badge dropdown

**Middleware changes:**
- Current: checks `profile.role`, redirects if pending
- New: checks `org_members` for `active_org_id`
  - No membership anywhere → `/pending`
  - Has membership but pending role → `/pending`
  - Has active role → allow through
  - `/admin/*` routes → check `org_role = 'admin'` OR `is_super_admin`

---

## 3. UX Changes

### Org Switcher — Profile Badge

**Single-org user:** Org name displayed as static label beneath user name in the profile badge. No dropdown.

**Multi-org user:** Dropdown in profile badge showing only orgs the user belongs to. Checkmark on active org. Selecting a different org:
1. Updates `active_org_id` on profile
2. Navigates to home/dashboard
3. All data refreshes to new org context

**Orgs the user doesn't belong to are completely invisible.** A Wildcats-only parent has zero awareness that Ottawa Ice exists.

### Admin: User Management (org-scoped)

- Org admin sees pending users who requested THEIR org only
- Approves with org-specific role (lite / full / admin)
- Creates `org_members` row on approval
- Super-admin can see pending users across ALL orgs and approve into any org

### Admin: Organization Management (super-admin only)

New page: `/admin/organizations`
- Create new organization (name, slug)
- View all organizations with member counts
- Assign initial org admin

### Invite System — Link + QR Code

**Admin page section** (in `/admin/users` or `/admin/invite`):
- Displays invite link: `cabot.app/join/[org-slug]`
- Displays QR code encoding the same URL
- Admin can copy link or screenshot/download QR
- Share via text, email, post at the rink, etc.

**`/join/[org-slug]` page:**
1. Shows org name + "Join [Org Name]" button
2. Google OAuth → creates profile if new user
3. Creates `org_members` row with `role = "pending"` for that org
4. Redirects to `/pending` showing the org name
5. Org admin sees them in `/admin/users` and approves

---

## 4. Server Actions

### Org Context Helper

New helper function used by ALL server actions as their first call:

```
getActiveOrgContext()
  → Returns { userId, orgId, role }
  → Fetches authenticated user
  → Reads active_org_id from profile
  → Verifies org_members row exists
  → Throws if no active org or no membership
```

### Affected Server Actions

Every server action must include `org_id` in queries:

| File | Changes |
|------|---------|
| lib/actions/players.ts | Add org_id to all CRUD + bulk operations |
| lib/actions/sessions.ts | Add org_id to create/update/delete/assign |
| lib/actions/rounds.ts | Add org_id to create + record results |
| lib/actions/crew.ts | Add org_id to add/update/remove crew |
| lib/actions/corrections.ts | Add org_id to submit/approve/reject |
| lib/actions/users.ts | Rewrite: approve into org, manage org-scoped roles |
| lib/actions/import.ts | Add org_id to bulk import (from admin's active org) |
| lib/actions/competition-prefs.ts | Add org_id to all preference operations |

### Client-Side Changes

- `AuthProvider` / `use-auth` hook: expose `activeOrgId` and `orgRole` in context
- All client pages: no changes to data fetching patterns (RLS handles filtering), but admin pages need org context for mutations
- `use-realtime-table` hook: add org_id filter to realtime subscriptions

---

## 5. Ottawa Ice Data Import & Validation

### Phase 1: Verify Wildcats Migration

After running the schema migration:
- [ ] All existing player data has `org_id = wildcats_id`
- [ ] All existing sessions, rounds, results have `org_id = wildcats_id`
- [ ] All existing users have `org_members` rows with correct roles
- [ ] All existing user_crew, scenarios, prefs have `org_id = wildcats_id`
- [ ] RLS policies working — users only see Wildcats data
- [ ] Admin functions work scoped to Wildcats
- [ ] Crew, scenarios, competition prefs all intact and functional

### Phase 2: Create Ottawa Ice Organization

- Super-admin creates "Ottawa Ice" org via `/admin/organizations`
- Assigns Ottawa Ice admin user (new or existing account)

### Phase 3: Import Ottawa Ice Data

1. Export Google Sheet as CSV
2. Ottawa Ice admin logs into Cabot
3. Navigate to `/admin/import`
4. Upload CSV — bulk import runs with `org_id = ottawa_ice_id` (automatic from admin's active org)

**Expected CSV columns:**

| Column | Required | Example |
|--------|----------|---------|
| number | Yes | 23 |
| first_name | Yes | Connor |
| last_name | Yes | Smith |
| position | No | F / D / G |
| birth_year | No | 2012 |
| previous_team | No | U13AA, U15B |
| entry_level | No | AA / A / BB / B / C |
| current_level | No | AA / A / BB / B / C |
| notes | No | free text |

### Phase 4: Validate Isolation

- [ ] Log in as Wildcats parent → confirm zero Ottawa Ice data visible
- [ ] Log in as Ottawa Ice admin → confirm zero Wildcats data visible
- [ ] Log in as super-admin → confirm both orgs visible
- [ ] Test crew: can only add players from active org
- [ ] Test sessions/rounds: scoped to active org only
- [ ] Test org switcher: switch between orgs, data updates correctly
- [ ] Test invite link: new user joins correct org via `/join/ottawa-ice`
- [ ] Test QR code: encodes correct invite URL

---

## 6. Out of Scope (for now)

- Cross-org player transfers
- Org-level branding/theming (custom colors per org)
- Org billing or usage limits
- Public org directory / discoverability
- Org-level settings beyond name/slug
