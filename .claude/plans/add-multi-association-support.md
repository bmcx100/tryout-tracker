# Multi-Association Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-tenancy so multiple hockey associations (Nepean Wildcats, Ottawa Ice, etc.) can each run their own isolated tryout tracking with per-org admins, per-org roles, and a global super-admin.

**Architecture:** Column-level tenancy — every data table gets an `org_id` FK to a new `organizations` table. A new `org_members` table replaces the global `role` column on profiles with per-org roles. RLS policies rewritten to scope all queries by the user's `active_org_id`. Super-admins bypass org scoping.

**Tech Stack:** Next.js 16, React 19, Supabase (PostgreSQL + RLS + Auth), TypeScript 5, Tailwind v4, shadcn/ui

**Design Spec:** `docs/superpowers/specs/2026-04-01-multi-tenancy-design.md`

---

## File Structure

### New Files
- `lib/actions/organizations.ts` — CRUD for organizations (super-admin only)
- `lib/actions/org-context.ts` — `getActiveOrgContext()` helper used by all server actions
- `app/(app)/admin/organizations/page.tsx` — Org management page (super-admin only)
- `app/join/[slug]/page.tsx` — Invite landing page for joining an org
- `components/org-switcher.tsx` — Org dropdown for profile badge

### Modified Files
- `lib/supabase/schema.sql` — New tables, columns, RLS policies, functions, trigger, view
- `lib/types.ts` — New types: Organization, OrgMember; updated Profile
- `lib/actions/users.ts` — Rewrite for org-scoped approval
- `lib/actions/players.ts` — Add org_id to all operations
- `lib/actions/sessions.ts` — Add org_id to all operations
- `lib/actions/rounds.ts` — Add org_id to all operations
- `lib/actions/crew.ts` — Add org_id to all operations
- `lib/actions/corrections.ts` — Add org_id to all operations
- `lib/actions/competition-prefs.ts` — Add org_id to all operations
- `lib/actions/import.ts` — Add org_id, change onConflict to composite
- `lib/actions/teams.ts` — Add org_id (confirmation actions already use player id, RLS handles scoping)
- `components/providers/auth-provider.tsx` — Expose activeOrgId, orgRole, userOrgs
- `components/app-header-auth.tsx` — Add org switcher component
- `lib/supabase/middleware.ts` — Check org_members instead of profile.role
- `app/pending/page.tsx` — Watch org_members instead of profile.role
- `app/(app)/admin/layout.tsx` — Check org-level admin role
- `app/(app)/admin/users/page.tsx` — Org-scoped user management
- `app/globals.css` — Styles for org switcher and new components

---

## Task 1: SQL Migration — Create New Tables

**Purpose:** Create the `organizations` and `org_members` tables that form the foundation of multi-tenancy.

**Files:**
- Create: SQL migration (run in Supabase SQL Editor)
- Reference: `lib/supabase/schema.sql:10-17` (current profiles table)

- [ ] **Step 1: Write the migration SQL for organizations table**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 1: New Tables
-- Run in Supabase SQL Editor
-- ========================================

-- Organizations table
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

grant select on public.organizations to authenticated;
grant insert, update, delete on public.organizations to authenticated;
```

- [ ] **Step 2: Write the migration SQL for org_members table**

```sql
-- Org members table — replaces role on profiles
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null default 'pending' check (role in ('pending', 'lite', 'full', 'admin')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table public.org_members enable row level security;

grant select, insert, update, delete on public.org_members to authenticated;
```

- [ ] **Step 3: Run the migration in Supabase SQL Editor**

Run the combined SQL from Steps 1 and 2 in the Supabase SQL Editor. Expected: both tables created successfully with RLS enabled.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add SQL migration notes for organizations and org_members tables"
```

---

## Task 2: SQL Migration — Modify Profiles Table

**Purpose:** Add `is_super_admin` and `active_org_id` to profiles. Do NOT remove `role`/`approved_at` yet — those get removed after data migration.

**Files:**
- Run in Supabase SQL Editor
- Reference: `lib/supabase/schema.sql:10-17`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 2: Modify profiles
-- ========================================

-- Add new columns (keep old ones for now — migration needs them)
alter table public.profiles
  add column is_super_admin boolean not null default false,
  add column active_org_id uuid references public.organizations(id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: columns added successfully. Existing rows get `is_super_admin = false` and `active_org_id = NULL`.

---

## Task 3: SQL Migration — Add org_id to All Data Tables

**Purpose:** Add nullable `org_id` column to every data table. Must be nullable first so we can backfill.

**Files:**
- Run in Supabase SQL Editor
- Reference: `lib/supabase/schema.sql:37-154` and `319-331`

- [ ] **Step 1: Write the migration SQL**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 3: Add org_id to data tables
-- ========================================

alter table public.players
  add column org_id uuid references public.organizations(id);

alter table public.sessions
  add column org_id uuid references public.organizations(id);

alter table public.session_players
  add column org_id uuid references public.organizations(id);

alter table public.rounds
  add column org_id uuid references public.organizations(id);

alter table public.round_results
  add column org_id uuid references public.organizations(id);

alter table public.user_crew
  add column org_id uuid references public.organizations(id);

alter table public.corrections
  add column org_id uuid references public.organizations(id);

alter table public.user_scenarios
  add column org_id uuid references public.organizations(id);

alter table public.user_competition_prefs
  add column org_id uuid references public.organizations(id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: all tables now have a nullable `org_id` column.

---

## Task 4: SQL Migration — Backfill Existing Data

**Purpose:** Create the Nepean Wildcats org, assign all existing data to it, migrate user roles to org_members, and tighten constraints.

**Files:**
- Run in Supabase SQL Editor

- [ ] **Step 1: Write the backfill SQL**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 4: Backfill existing data
-- ========================================

-- 1. Create Nepean Wildcats organization
insert into public.organizations (id, name, slug)
values (gen_random_uuid(), 'Nepean Wildcats', 'nepean-wildcats');

-- 2. Get the wildcats org id for backfill
do $$
declare
  wildcats_id uuid;
begin
  select id into wildcats_id from public.organizations where slug = 'nepean-wildcats';

  -- 3. Backfill org_id on all data tables
  update public.players set org_id = wildcats_id where org_id is null;
  update public.sessions set org_id = wildcats_id where org_id is null;
  update public.session_players set org_id = wildcats_id where org_id is null;
  update public.rounds set org_id = wildcats_id where org_id is null;
  update public.round_results set org_id = wildcats_id where org_id is null;
  update public.user_crew set org_id = wildcats_id where org_id is null;
  update public.corrections set org_id = wildcats_id where org_id is null;
  update public.user_scenarios set org_id = wildcats_id where org_id is null;
  update public.user_competition_prefs set org_id = wildcats_id where org_id is null;

  -- 4. Migrate existing profile roles to org_members
  insert into public.org_members (org_id, user_id, role, approved_at)
  select wildcats_id, id, role, approved_at
  from public.profiles
  where role != 'pending';

  -- 5. Create pending org_members for pending users too
  insert into public.org_members (org_id, user_id, role)
  select wildcats_id, id, 'pending'
  from public.profiles
  where role = 'pending';

  -- 6. Set active_org_id for all users
  update public.profiles set active_org_id = wildcats_id;
end $$;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: all rows have org_id set. All users have org_members rows.

- [ ] **Step 3: Verify the backfill**

Run these verification queries:

```sql
-- Should return 0 for each
select count(*) from public.players where org_id is null;
select count(*) from public.sessions where org_id is null;
select count(*) from public.user_crew where org_id is null;
select count(*) from public.profiles where active_org_id is null;

-- Should match total profile count
select count(*) from public.org_members;
select count(*) from public.profiles;
```

---

## Task 5: SQL Migration — Tighten Constraints

**Purpose:** Make org_id NOT NULL, update unique constraints, drop old columns from profiles.

**Files:**
- Run in Supabase SQL Editor

- [ ] **Step 1: Write the constraint migration SQL**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 5: Tighten constraints
-- ========================================

-- Make org_id NOT NULL on all tables
alter table public.players alter column org_id set not null;
alter table public.sessions alter column org_id set not null;
alter table public.session_players alter column org_id set not null;
alter table public.rounds alter column org_id set not null;
alter table public.round_results alter column org_id set not null;
alter table public.user_crew alter column org_id set not null;
alter table public.corrections alter column org_id set not null;
alter table public.user_scenarios alter column org_id set not null;
alter table public.user_competition_prefs alter column org_id set not null;

-- Update unique constraints to include org_id
-- Players: (number) → (org_id, number)
alter table public.players drop constraint players_number_key;
alter table public.players add constraint players_org_number_key unique (org_id, number);

-- Rounds: (level, round_number) → (org_id, level, round_number)
alter table public.rounds drop constraint rounds_level_round_number_key;
alter table public.rounds add constraint rounds_org_level_round_number_key unique (org_id, level, round_number);

-- user_crew: (user_id, player_number) → (org_id, user_id, player_number)
alter table public.user_crew drop constraint user_crew_user_id_player_number_key;
alter table public.user_crew add constraint user_crew_org_user_player_key unique (org_id, user_id, player_number);

-- user_scenarios: (user_id, name) → (org_id, user_id, name)
alter table public.user_scenarios drop constraint user_scenarios_user_id_name_key;
alter table public.user_scenarios add constraint user_scenarios_org_user_name_key unique (org_id, user_id, name);

-- user_competition_prefs: (user_id, position_group) → (org_id, user_id, position_group)
alter table public.user_competition_prefs drop constraint user_competition_prefs_user_id_position_group_key;
alter table public.user_competition_prefs add constraint user_competition_prefs_org_user_pos_key unique (org_id, user_id, position_group);

-- Drop old columns from profiles
alter table public.profiles drop column role;
alter table public.profiles drop column approved_at;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: all constraints updated, old columns dropped. If any constraint name doesn't match exactly, check `\d tablename` in Supabase SQL editor first and use the actual constraint name.

---

## Task 6: SQL Migration — RLS Helper Functions

**Purpose:** Replace `get_user_role()` with new org-aware helper functions.

**Files:**
- Run in Supabase SQL Editor
- Reference: `lib/supabase/schema.sql:160-163`

- [ ] **Step 1: Write the new helper functions**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 6: RLS helper functions
-- ========================================

-- Get current user's active org id
create or replace function public.get_active_org_id()
returns uuid as $$
  select active_org_id from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- Get user's role in a specific org
create or replace function public.get_org_role(target_org_id uuid)
returns text as $$
  select role from public.org_members
  where user_id = auth.uid() and org_id = target_org_id
$$ language sql security definer stable;

-- Check if current user is super admin
create or replace function public.is_super_admin()
returns boolean as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  )
$$ language sql security definer stable;

-- Keep old function working during transition (returns role from active org)
create or replace function public.get_user_role()
returns text as $$
  select role from public.org_members
  where user_id = auth.uid() and org_id = public.get_active_org_id()
$$ language sql security definer stable;

-- Grant execute permissions
grant execute on function public.get_active_org_id() to authenticated;
grant execute on function public.get_org_role(uuid) to authenticated;
grant execute on function public.is_super_admin() to authenticated;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: all functions created. `get_user_role()` still works (returns role from active org) for backward compatibility during the transition.

---

## Task 7: SQL Migration — Rewrite All RLS Policies

**Purpose:** Drop all existing RLS policies and recreate them with org-aware scoping.

**Files:**
- Run in Supabase SQL Editor
- Reference: `lib/supabase/schema.sql:166-350`

- [ ] **Step 1: Write the RLS policy migration — profiles and organizations**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 7: Rewrite RLS policies
-- ========================================

-- ===== PROFILES =====
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;

-- Users can always read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Org admins can read profiles of members in their org
create policy "Org admins can read org member profiles"
  on public.profiles for select
  using (
    id in (
      select user_id from public.org_members
      where org_id = public.get_active_org_id()
    )
    and public.get_org_role(public.get_active_org_id()) = 'admin'
  );

-- Super admins can read all profiles
create policy "Super admins can read all profiles"
  on public.profiles for select
  using (public.is_super_admin());

-- Users can update their own profile (for active_org_id switching)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Super admins can update any profile
create policy "Super admins can update all profiles"
  on public.profiles for update
  using (public.is_super_admin());

-- ===== ORGANIZATIONS =====
-- Members can see orgs they belong to
create policy "Members can read own orgs"
  on public.organizations for select
  using (
    id in (select org_id from public.org_members where user_id = auth.uid())
  );

-- Super admins can see all orgs
create policy "Super admins can read all orgs"
  on public.organizations for select
  using (public.is_super_admin());

-- Only super admins can create/update/delete orgs
create policy "Super admins can insert orgs"
  on public.organizations for insert
  with check (public.is_super_admin());

create policy "Super admins can update orgs"
  on public.organizations for update
  using (public.is_super_admin());

create policy "Super admins can delete orgs"
  on public.organizations for delete
  using (public.is_super_admin());

-- ===== ORG_MEMBERS =====
-- Users can read their own memberships
create policy "Users can read own memberships"
  on public.org_members for select
  using (auth.uid() = user_id);

-- Org admins can read all members in their org
create policy "Org admins can read org members"
  on public.org_members for select
  using (public.get_org_role(org_id) = 'admin');

-- Super admins can read all memberships
create policy "Super admins can read all memberships"
  on public.org_members for select
  using (public.is_super_admin());

-- Org admins can insert members into their org
create policy "Org admins can insert org members"
  on public.org_members for insert
  with check (
    public.get_org_role(org_id) = 'admin'
    or public.is_super_admin()
  );

-- Org admins can update members in their org
create policy "Org admins can update org members"
  on public.org_members for update
  using (
    public.get_org_role(org_id) = 'admin'
    or public.is_super_admin()
  );

-- Org admins can delete members from their org
create policy "Org admins can delete org members"
  on public.org_members for delete
  using (
    public.get_org_role(org_id) = 'admin'
    or public.is_super_admin()
  );
```

- [ ] **Step 2: Run Step 1 in Supabase SQL Editor**

Expected: profiles, organizations, and org_members policies created.

- [ ] **Step 3: Write the RLS policy migration — data tables**

```sql
-- ===== PLAYERS =====
drop policy if exists "Approved users can read players" on public.players;
drop policy if exists "Admins can insert players" on public.players;
drop policy if exists "Admins can update players" on public.players;
drop policy if exists "Admins can delete players" on public.players;

create policy "Org members can read players"
  on public.players for select
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  );

create policy "Org admins can insert players"
  on public.players for insert
  with check (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

create policy "Org admins can update players"
  on public.players for update
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

create policy "Org admins can delete players"
  on public.players for delete
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

-- ===== SESSIONS =====
drop policy if exists "Approved users can read sessions" on public.sessions;
drop policy if exists "Admins can manage sessions" on public.sessions;

create policy "Org members can read sessions"
  on public.sessions for select
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  );

create policy "Org admins can manage sessions"
  on public.sessions for all
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

-- ===== SESSION_PLAYERS =====
drop policy if exists "Approved users can read session_players" on public.session_players;
drop policy if exists "Admins can manage session_players" on public.session_players;

create policy "Org members can read session_players"
  on public.session_players for select
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  );

create policy "Org admins can manage session_players"
  on public.session_players for all
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

-- ===== ROUNDS =====
drop policy if exists "Approved users can read rounds" on public.rounds;
drop policy if exists "Admins can manage rounds" on public.rounds;

create policy "Org members can read rounds"
  on public.rounds for select
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  );

create policy "Org admins can manage rounds"
  on public.rounds for all
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

-- ===== ROUND_RESULTS =====
drop policy if exists "Approved users can read round_results" on public.round_results;
drop policy if exists "Admins can manage round_results" on public.round_results;

create policy "Org members can read round_results"
  on public.round_results for select
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  );

create policy "Org admins can manage round_results"
  on public.round_results for all
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );
```

- [ ] **Step 4: Run Step 3 in Supabase SQL Editor**

Expected: all data table policies recreated with org scoping.

- [ ] **Step 5: Write the RLS policy migration — user-scoped tables**

```sql
-- ===== USER_CREW =====
drop policy if exists "Users can read own crew" on public.user_crew;
drop policy if exists "Users can insert own crew" on public.user_crew;
drop policy if exists "Users can update own crew" on public.user_crew;
drop policy if exists "Users can delete own crew" on public.user_crew;

create policy "Users can read own crew in active org"
  on public.user_crew for select
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can insert own crew in active org"
  on public.user_crew for insert
  with check (
    auth.uid() = user_id
    and org_id = public.get_active_org_id()
    and public.get_org_role(org_id) in ('lite', 'full', 'admin')
  );

create policy "Users can update own crew"
  on public.user_crew for update
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can delete own crew"
  on public.user_crew for delete
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

-- ===== CORRECTIONS =====
drop policy if exists "Users can read own corrections" on public.corrections;
drop policy if exists "Users can insert corrections" on public.corrections;
drop policy if exists "Admins can read all corrections" on public.corrections;
drop policy if exists "Admins can update corrections" on public.corrections;

create policy "Users can read own corrections in active org"
  on public.corrections for select
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can insert corrections in active org"
  on public.corrections for insert
  with check (
    auth.uid() = user_id
    and org_id = public.get_active_org_id()
    and public.get_org_role(org_id) in ('lite', 'full', 'admin')
  );

create policy "Org admins can read all corrections"
  on public.corrections for select
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

create policy "Org admins can update corrections"
  on public.corrections for update
  using (
    (org_id = public.get_active_org_id()
     and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  );

-- ===== USER_SCENARIOS =====
drop policy if exists "Users can read own or shared scenarios" on public.user_scenarios;
drop policy if exists "Users can insert own scenarios" on public.user_scenarios;
drop policy if exists "Users can update own scenarios" on public.user_scenarios;
drop policy if exists "Users can delete own scenarios" on public.user_scenarios;

create policy "Users can read own or shared scenarios in org"
  on public.user_scenarios for select
  using (
    org_id = public.get_active_org_id()
    and (auth.uid() = user_id or is_shared = true)
  );

create policy "Users can insert own scenarios in active org"
  on public.user_scenarios for insert
  with check (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can update own scenarios"
  on public.user_scenarios for update
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can delete own scenarios"
  on public.user_scenarios for delete
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

-- ===== USER_COMPETITION_PREFS =====
drop policy if exists "Users can read own competition prefs" on public.user_competition_prefs;
drop policy if exists "Users can insert own competition prefs" on public.user_competition_prefs;
drop policy if exists "Users can update own competition prefs" on public.user_competition_prefs;
drop policy if exists "Users can delete own competition prefs" on public.user_competition_prefs;

create policy "Users can read own prefs in active org"
  on public.user_competition_prefs for select
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can insert own prefs in active org"
  on public.user_competition_prefs for insert
  with check (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can update own prefs in active org"
  on public.user_competition_prefs for update
  using (auth.uid() = user_id and org_id = public.get_active_org_id());

create policy "Users can delete own prefs in active org"
  on public.user_competition_prefs for delete
  using (auth.uid() = user_id and org_id = public.get_active_org_id());
```

- [ ] **Step 6: Run Step 5 in Supabase SQL Editor**

Expected: all user-scoped table policies recreated.

---

## Task 8: SQL Migration — Update Trigger, View, and Allow Join Inserts

**Purpose:** Update `handle_new_user()` trigger to stop setting role, update `players_view` to be org-aware, and allow self-insert for join flow.

**Files:**
- Run in Supabase SQL Editor
- Reference: `lib/supabase/schema.sql:20-31` and `202-212`

- [ ] **Step 1: Write the trigger and view updates**

```sql
-- ========================================
-- MULTI-TENANCY MIGRATION — Part 8: Trigger + View
-- ========================================

-- Update trigger — no longer sets role (that's in org_members now)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Update players_view to be org-aware
create or replace view public.players_view as
  select
    id, number, org_id,
    case when public.get_org_role(org_id) in ('full', 'admin')
         or public.is_super_admin()
         then first_name else null end as first_name,
    case when public.get_org_role(org_id) in ('full', 'admin')
         or public.is_super_admin()
         then last_name else null end as last_name,
    previous_team, position, birth_year, notes,
    entry_level, current_level,
    info_confirmed, checked_in,
    status, team_placed, created_at, updated_at
  from public.players;

-- Allow users to insert themselves into org_members (for /join flow)
-- This is in addition to the admin insert policy
create policy "Users can insert own pending membership"
  on public.org_members for insert
  with check (auth.uid() = user_id and role = 'pending');

-- Allow anyone (including anon) to read org name/slug for the /join page
-- Org names and slugs are not sensitive — they're needed for the invite flow
create policy "Anyone can read organizations"
  on public.organizations for select
  using (true);

-- Grant anon access so unauthenticated users can see /join/[slug] page
grant select on public.organizations to anon;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Expected: trigger updated (the trigger itself already exists, so `CREATE OR REPLACE` works). View recreated with org_id column and org-aware name hiding. Users can self-insert as pending into org_members.

---

## Task 9: Update TypeScript Types

**Purpose:** Add Organization, OrgMember types. Update Profile to match new schema.

**Files:**
- Modify: `lib/types.ts:1-125`

- [ ] **Step 1: Add Organization and OrgMember types**

Add these new types to `lib/types.ts` after the existing type definitions (after line 19, before the Profile interface):

```typescript
export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: UserRole
  approved_at: string | null
  created_at: string
}
```

- [ ] **Step 2: Update the Profile interface**

Replace the existing Profile interface at `lib/types.ts:21-28`:

```typescript
export interface Profile {
  id: string
  email: string
  display_name: string | null
  is_super_admin: boolean
  active_org_id: string | null
  created_at: string
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `npm run build`

Expected: Build will fail with type errors in files that reference `profile.role` and `profile.approved_at`. This is expected — we'll fix those in subsequent tasks. Note which files fail for reference.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add Organization and OrgMember types, update Profile for multi-tenancy"
```

---

## Task 10: Create Org Context Helper

**Purpose:** Create the `getActiveOrgContext()` helper that all server actions will use to get the current user's org context.

**Files:**
- Create: `lib/actions/org-context.ts`

- [ ] **Step 1: Create the org context helper**

Create `lib/actions/org-context.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"

export interface OrgContext {
  userId: string
  orgId: string
  role: string
}

export async function getActiveOrgContext(): Promise<OrgContext> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", user.id)
    .single()

  if (!profile?.active_org_id) throw new Error("No active organization")

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", profile.active_org_id)
    .eq("user_id", user.id)
    .single()

  if (!membership) throw new Error("Not a member of active organization")

  return {
    userId: user.id,
    orgId: profile.active_org_id,
    role: membership.role,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/org-context.ts
git commit -m "feat: add getActiveOrgContext helper for server actions"
```

---

## Task 11: Update Server Actions — Players

**Purpose:** Add org_id to all player CRUD operations.

**Files:**
- Modify: `lib/actions/players.ts:1-107`
- Reference: `lib/actions/org-context.ts`

- [ ] **Step 1: Rewrite players.ts**

Replace the entire contents of `lib/actions/players.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { PlayerLevel, PlayerStatus } from "@/lib/types"

export async function createPlayer(data: {
  number: number
  first_name?: string
  last_name?: string
  previous_team?: string | null
  position?: string
  birth_year?: number
  notes?: string
  entry_level?: PlayerLevel | null
  current_level?: PlayerLevel | null
}) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()
  const { error } = await supabase.from("players").insert({
    ...data,
    org_id: orgId,
    status: "active_tryout" as PlayerStatus,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}

export async function updatePlayer(
  id: string,
  data: {
    number?: number
    first_name?: string | null
    last_name?: string | null
    previous_team?: string | null
    position?: string | null
    birth_year?: number | null
    notes?: string | null
    entry_level?: PlayerLevel | null
    current_level?: PlayerLevel | null
    status?: PlayerStatus
    team_placed?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("players")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}

export async function deletePlayer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("players").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}

export async function bulkCreatePlayers(
  rows: {
    number: number
    first_name?: string
    last_name?: string
    previous_team?: string
    position?: string
    birth_year?: number
    notes?: string
    entry_level?: PlayerLevel
    current_level?: PlayerLevel
  }[]
) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()
  const records = rows.map((row) => ({
    ...row,
    org_id: orgId,
    status: "active_tryout" as PlayerStatus,
  }))

  const { data, error } = await supabase.from("players").insert(records).select()
  if (error) throw new Error(error.message)

  revalidatePath("/admin/players")
  return { inserted: data?.length ?? 0 }
}

export async function bulkUpdatePlayerStatus(
  ids: string[],
  status: PlayerStatus,
  currentLevel?: PlayerLevel
) {
  const supabase = await createClient()
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (currentLevel) update.current_level = currentLevel

  const { error } = await supabase
    .from("players")
    .update(update)
    .in("id", ids)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/players")
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/players.ts
git commit -m "feat: add org_id to player server actions"
```

---

## Task 12: Update Server Actions — Sessions

**Purpose:** Add org_id to all session operations.

**Files:**
- Modify: `lib/actions/sessions.ts:1-83`

- [ ] **Step 1: Rewrite sessions.ts**

Replace the entire contents of `lib/actions/sessions.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { PlayerLevel } from "@/lib/types"

export async function createSession(data: {
  level: PlayerLevel
  round_number: number
  group_number: number
  date: string
  start_time: string
  end_time: string
  rink: string
  notes?: string
}) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").insert({
    ...data,
    org_id: orgId,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/current")
}

export async function updateSession(
  id: string,
  data: {
    level?: PlayerLevel
    round_number?: number
    group_number?: number
    date?: string
    start_time?: string
    end_time?: string
    rink?: string
    notes?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("sessions")
    .update(data)
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/current")
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("sessions").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/sessions")
  revalidatePath("/current")
}

export async function assignPlayersToSession(
  sessionId: string,
  playerNumbers: number[]
) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  // Remove existing assignments
  await supabase
    .from("session_players")
    .delete()
    .eq("session_id", sessionId)

  // Insert new assignments
  if (playerNumbers.length > 0) {
    const { error } = await supabase.from("session_players").insert(
      playerNumbers.map((num) => ({
        session_id: sessionId,
        player_number: num,
        org_id: orgId,
      }))
    )
    if (error) throw new Error(error.message)
  }

  revalidatePath("/admin/sessions")
  revalidatePath("/current")
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/sessions.ts
git commit -m "feat: add org_id to session server actions"
```

---

## Task 13: Update Server Actions — Rounds

**Purpose:** Add org_id to round creation and result recording.

**Files:**
- Modify: `lib/actions/rounds.ts:1-88`

- [ ] **Step 1: Rewrite rounds.ts**

Replace the entire contents of `lib/actions/rounds.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { PlayerLevel, RoundResult } from "@/lib/types"

export async function createRound(data: {
  level: PlayerLevel
  round_number: number
  date: string
  notes?: string
}) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()
  const { error } = await supabase.from("rounds").insert({
    ...data,
    org_id: orgId,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/rounds")
}

export async function recordRoundResults(
  roundId: string,
  results: Array<{
    player_number: number
    result: RoundResult
    notes?: string
  }>
) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  // Insert results
  const { error: resultError } = await supabase.from("round_results").insert(
    results.map((r) => ({
      round_id: roundId,
      player_number: r.player_number,
      result: r.result,
      notes: r.notes,
      org_id: orgId,
    }))
  )

  if (resultError) throw new Error(resultError.message)

  // Cascade status updates
  const { data: round } = await supabase
    .from("rounds")
    .select("level")
    .eq("id", roundId)
    .single()

  if (!round) return

  const levels: PlayerLevel[] = ["AA", "A", "BB", "B", "C"]
  const currentIdx = levels.indexOf(round.level as PlayerLevel)

  for (const r of results) {
    if (r.result === "cut_down" && currentIdx < levels.length - 1) {
      await supabase
        .from("players")
        .update({
          status: "cut_to_next_level",
          current_level: levels[currentIdx + 1],
          updated_at: new Date().toISOString(),
        })
        .eq("number", r.player_number)
        .eq("org_id", orgId)
    } else if (r.result === "placed") {
      await supabase
        .from("players")
        .update({
          status: "placed_on_team",
          updated_at: new Date().toISOString(),
        })
        .eq("number", r.player_number)
        .eq("org_id", orgId)
    } else if (r.result === "withdrawn") {
      await supabase
        .from("players")
        .update({
          status: "withdrawn",
          updated_at: new Date().toISOString(),
        })
        .eq("number", r.player_number)
        .eq("org_id", orgId)
    }
  }

  revalidatePath("/admin/rounds")
  revalidatePath("/crew")
  revalidatePath("/home")
  revalidatePath("/current")
  revalidatePath("/players")
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/rounds.ts
git commit -m "feat: add org_id to round server actions"
```

---

## Task 14: Update Server Actions — Crew

**Purpose:** Add org_id to crew operations.

**Files:**
- Modify: `lib/actions/crew.ts:1-56`

- [ ] **Step 1: Rewrite crew.ts**

Replace the entire contents of `lib/actions/crew.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { CrewTag } from "@/lib/types"

export async function addToCrew(data: {
  player_number: number
  personal_name: string
  tag: CrewTag
  notes?: string
}) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase.from("user_crew").insert({
    user_id: userId,
    org_id: orgId,
    ...data,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/crew")
  revalidatePath("/home")
  revalidatePath("/current")
  revalidatePath("/players")
}

export async function updateCrewMember(
  id: string,
  data: {
    personal_name?: string
    tag?: CrewTag
    notes?: string | null
  }
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("user_crew")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/crew")
}

export async function removeFromCrew(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("user_crew").delete().eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/crew")
  revalidatePath("/home")
  revalidatePath("/current")
  revalidatePath("/players")
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/crew.ts
git commit -m "feat: add org_id to crew server actions"
```

---

## Task 15: Update Server Actions — Corrections, Import, Teams

**Purpose:** Add org_id to corrections, import, and teams actions.

**Files:**
- Modify: `lib/actions/corrections.ts:1-41`
- Modify: `lib/actions/import.ts:1-27`
- Modify: `lib/actions/teams.ts:1-37`

- [ ] **Step 1: Rewrite corrections.ts**

Replace the entire contents of `lib/actions/corrections.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { CorrectionEntityType } from "@/lib/types"

export async function submitCorrection(data: {
  player_number?: number
  entity_type: CorrectionEntityType
  entity_id: string
  field: string
  current_value: string
  suggested_value: string
}) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase.from("corrections").insert({
    user_id: userId,
    org_id: orgId,
    ...data,
  })

  if (error) throw new Error(error.message)
  revalidatePath("/admin/corrections")
}

export async function resolveCorrection(
  id: string,
  status: "approved" | "rejected",
  adminNotes?: string
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("corrections")
    .update({ status, admin_notes: adminNotes || null })
    .eq("id", id)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/corrections")
}
```

- [ ] **Step 2: Rewrite import.ts**

Replace the entire contents of `lib/actions/import.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"

export async function confirmImport(players: Array<{ number: number; first_name?: string; last_name?: string }>) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  for (const player of players) {
    const { error } = await supabase.from("players").upsert(
      {
        number: player.number,
        first_name: player.first_name || null,
        last_name: player.last_name || null,
        status: "active_tryout",
        org_id: orgId,
      },
      { onConflict: "org_id,number" }
    )

    if (error) {
      throw new Error(`Failed to import player #${player.number}: ${error.message}`)
    }
  }

  revalidatePath("/admin/players")
  revalidatePath("/players")
}
```

- [ ] **Step 3: Teams actions stay mostly the same**

`lib/actions/teams.ts` uses `player.id` (UUID) for updates, and RLS already scopes by org. No code changes needed — the existing `togglePlayerConfirmation` and `bulkConfirmTeam` update players by UUID, and the new RLS policies ensure they can only update players in their org.

- [ ] **Step 4: Commit**

```bash
git add lib/actions/corrections.ts lib/actions/import.ts
git commit -m "feat: add org_id to corrections and import server actions"
```

---

## Task 16: Update Server Actions — Competition Prefs

**Purpose:** Add org_id to all competition preference operations. This is the largest action file.

**Files:**
- Modify: `lib/actions/competition-prefs.ts:1-219`

- [ ] **Step 1: Rewrite competition-prefs.ts**

Replace the entire contents of `lib/actions/competition-prefs.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { UserCompetitionPrefs, PositionGroup } from "@/lib/types"

export async function getCompetitionPrefs(
  positionGroup: PositionGroup
): Promise<UserCompetitionPrefs | null> {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)
    .single()

  if (error && error.code !== "PGRST116") throw new Error(error.message)
  return data
}

export async function getAllCompetitionPrefs(): Promise<UserCompetitionPrefs[]> {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("user_competition_prefs")
    .select("*")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .order("last_viewed", { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function updateTeamOrder(teamOrder: string[]) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: "global",
      team_order: teamOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function updatePlayerOrder(
  positionGroup: PositionGroup,
  team: string,
  playerNumbers: number[]
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  const playerOrder = existing?.player_order || {}
  playerOrder[team] = playerNumbers

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      player_order: playerOrder,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function pinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number,
  targetTeam: string,
  position: number
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  const pinnedPlayers = existing?.pinned_players || {}
  pinnedPlayers[String(playerNumber)] = { team: targetTeam, position }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function unpinPlayer(
  positionGroup: PositionGroup,
  playerNumber: number
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  if (!existing) return

  const pinnedPlayers = { ...existing.pinned_players }
  delete pinnedPlayers[String(playerNumber)]

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      pinned_players: pinnedPlayers,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function updateTeamSlots(
  positionGroup: PositionGroup,
  teamCode: string,
  slots: Record<string, number> | null
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const existing = await getCompetitionPrefs(positionGroup)
  const teamSlots = existing?.team_slots || {}
  if (slots) {
    teamSlots[teamCode] = slots
  } else {
    delete teamSlots[teamCode]
  }

  const { error } = await supabase
    .from("user_competition_prefs")
    .upsert({
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      team_slots: teamSlots,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}

export async function markLastViewed(positionGroup: PositionGroup) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_competition_prefs")
    .update({
      last_viewed: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function resetPrefs(positionGroup: PositionGroup) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("user_competition_prefs")
    .delete()
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("position_group", positionGroup)

  if (error) throw new Error(error.message)
}

export async function updatePositionOverrides(
  positionGroup: PositionGroup,
  playerNumber: number,
  newPosition: string | null
) {
  const { userId, orgId } = await getActiveOrgContext()
  const supabase = await createClient()

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
      user_id: userId,
      org_id: orgId,
      position_group: positionGroup,
      position_overrides: overrides,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,user_id,position_group" })

  if (error) throw new Error(error.message)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/competition-prefs.ts
git commit -m "feat: add org_id to competition prefs server actions"
```

---

## Task 17: Rewrite Server Actions — Users

**Purpose:** Replace global role management with org-scoped membership management.

**Files:**
- Modify: `lib/actions/users.ts:1-30`

- [ ] **Step 1: Rewrite users.ts**

Replace the entire contents of `lib/actions/users.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgContext } from "@/lib/actions/org-context"
import type { UserRole } from "@/lib/types"

export async function approveUser(userId: string, role: "lite" | "full") {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("org_members")
    .update({
      role,
      approved_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("user_id", userId)

  if (error) throw new Error(error.message)

  // Set active_org_id if user doesn't have one yet
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single()

  if (profile && !profile.active_org_id) {
    await supabase
      .from("profiles")
      .update({ active_org_id: orgId })
      .eq("id", userId)
  }

  revalidatePath("/admin/users")
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { orgId } = await getActiveOrgContext()
  const supabase = await createClient()

  const { error } = await supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", userId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/users")
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/users.ts
git commit -m "feat: rewrite user actions for org-scoped role management"
```

---

## Task 18: Create Server Actions — Organizations

**Purpose:** CRUD for organizations (super-admin only) and org switching.

**Files:**
- Create: `lib/actions/organizations.ts`

- [ ] **Step 1: Create organizations.ts**

Create `lib/actions/organizations.ts`:

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"

export async function createOrganization(data: { name: string; slug: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from("organizations").insert(data)

  if (error) throw new Error(error.message)
  revalidatePath("/admin/organizations")
}

export async function assignOrgAdmin(orgId: string, userId: string) {
  const supabase = await createClient()

  // Check if user already has membership
  const { data: existing } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single()

  if (existing) {
    // Update existing membership to admin
    const { error } = await supabase
      .from("org_members")
      .update({ role: "admin", approved_at: new Date().toISOString() })
      .eq("id", existing.id)
    if (error) throw new Error(error.message)
  } else {
    // Create new admin membership
    const { error } = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: userId,
      role: "admin",
      approved_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)
  }

  // Set active_org_id if user doesn't have one
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_org_id")
    .eq("id", userId)
    .single()

  if (profile && !profile.active_org_id) {
    await supabase
      .from("profiles")
      .update({ active_org_id: orgId })
      .eq("id", userId)
  }

  revalidatePath("/admin/organizations")
}

export async function switchOrg(orgId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  // Verify user has membership in this org
  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .single()

  if (!membership || membership.role === "pending") {
    throw new Error("No active membership in this organization")
  }

  const { error } = await supabase
    .from("profiles")
    .update({ active_org_id: orgId })
    .eq("id", user.id)

  if (error) throw new Error(error.message)

  revalidatePath("/home")
  revalidatePath("/crew")
  revalidatePath("/players")
  revalidatePath("/current")
}

export async function getUserOrgs() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .neq("role", "pending")

  if (error) throw new Error(error.message)
  return data || []
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/organizations.ts
git commit -m "feat: add organization CRUD and switching server actions"
```

---

## Task 19: Update Auth Provider

**Purpose:** Expose `activeOrgId`, `orgRole`, and `userOrgs` in auth context. Fetch org membership alongside profile.

**Files:**
- Modify: `components/providers/auth-provider.tsx:1-101`

- [ ] **Step 1: Rewrite auth-provider.tsx**

Replace the entire contents of `components/providers/auth-provider.tsx`:

```typescript
"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { Profile, Organization } from "@/lib/types"

interface UserOrg {
  org_id: string
  role: string
  organizations: Organization
}

interface AuthContext {
  user: User | null
  profile: Profile | null
  activeOrgId: string | null
  orgRole: string | null
  userOrgs: UserOrg[]
  loading: boolean
  signOut: () => Promise<void>
  refreshOrgs: () => Promise<void>
}

const AuthContext = createContext<AuthContext>({
  user: null,
  profile: null,
  activeOrgId: null,
  orgRole: null,
  userOrgs: [],
  loading: true,
  signOut: async () => {},
  refreshOrgs: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userOrgs, setUserOrgs] = useState<UserOrg[]>([])
  const [loading, setLoading] = useState(true)
  const hadUser = useRef(false)
  const supabase = createClient()
  const router = useRouter()

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()
    setProfile(data)
    return data
  }

  const fetchOrgs = async (userId: string) => {
    const { data } = await supabase
      .from("org_members")
      .select("org_id, role, organizations(id, name, slug)")
      .eq("user_id", userId)
      .neq("role", "pending")
    setUserOrgs((data as UserOrg[]) || [])
    return (data as UserOrg[]) || []
  }

  const refreshOrgs = async () => {
    if (user) {
      await fetchOrgs(user.id)
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      if (authUser) {
        hadUser.current = true
        await fetchProfile(authUser.id)
        await fetchOrgs(authUser.id)
      }
      setLoading(false)
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "INITIAL_SESSION") return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          hadUser.current = true
          if (event === "SIGNED_IN" || event === "USER_UPDATED") {
            await fetchProfile(currentUser.id)
            await fetchOrgs(currentUser.id)
          }
        } else {
          setProfile(null)
          setUserOrgs([])
          if (hadUser.current) {
            router.push("/login")
          }
        }

        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setUserOrgs([])
  }

  const activeOrgId = profile?.active_org_id ?? null
  const orgRole = activeOrgId
    ? (userOrgs.find((o) => o.org_id === activeOrgId)?.role ?? null)
    : null

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      activeOrgId,
      orgRole,
      userOrgs,
      loading,
      signOut,
      refreshOrgs,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
```

- [ ] **Step 2: Commit**

```bash
git add components/providers/auth-provider.tsx
git commit -m "feat: add org context to auth provider"
```

---

## Task 20: Update Middleware

**Purpose:** Check org_members instead of profiles.role for access control.

**Files:**
- Modify: `lib/supabase/middleware.ts:1-80`

- [ ] **Step 1: Rewrite middleware.ts**

Replace the entire contents of `lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/login", "/pending", "/auth/callback"]
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith("/auth/") || pathname.startsWith("/join/")
  )

  // Redirect logged-in users from landing page to app
  if (user && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/home"
    return NextResponse.redirect(url)
  }

  // Redirect unauthenticated users to login for protected routes
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // For all protected routes, check org-based access
  if (user && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_org_id, is_super_admin")
      .eq("id", user.id)
      .single()

    // No active org — redirect to pending
    if (!profile || !profile.active_org_id) {
      const url = request.nextUrl.clone()
      url.pathname = "/pending"
      return NextResponse.redirect(url)
    }

    // Check org membership
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", profile.active_org_id)
      .eq("user_id", user.id)
      .single()

    // No membership or pending — redirect to pending
    if (!membership || membership.role === "pending") {
      const url = request.nextUrl.clone()
      url.pathname = "/pending"
      return NextResponse.redirect(url)
    }

    // Block non-admin users from admin routes (unless super-admin)
    if (pathname.startsWith("/admin") && membership.role !== "admin" && !profile.is_super_admin) {
      const url = request.nextUrl.clone()
      url.pathname = "/home"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "feat: update middleware for org-based access control"
```

---

## Task 21: Update Pending Page

**Purpose:** Watch org_members for approval instead of profiles.role.

**Files:**
- Modify: `app/pending/page.tsx:1-77`

- [ ] **Step 1: Rewrite pending page**

Replace the entire contents of `app/pending/page.tsx`:

```typescript
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function PendingPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel("membership-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "org_members",
        },
        (payload) => {
          if (payload.new.role !== "pending") {
            router.push("/home")
          }
        }
      )
      .subscribe()

    // Polling fallback — check every 10s
    const interval = setInterval(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: memberships } = await supabase
        .from("org_members")
        .select("role, org_id")
        .eq("user_id", user.id)
        .neq("role", "pending")

      if (memberships && memberships.length > 0) {
        // Set active_org_id to first approved org
        await supabase
          .from("profiles")
          .update({ active_org_id: memberships[0].org_id })
          .eq("id", user.id)
        router.push("/home")
      }
    }, 10000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [router])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="pending-page">
      <div className="pending-card">
        <div className="pending-brand">TRYOUT TRACKER</div>
        <h1 className="pending-headline">Almost there</h1>
        <p className="pending-body">
          An admin needs to let you in. Once approved, you can start
          tracking your crew.
        </p>
        <div className="pending-status">
          <div className="pending-dot" />
          <span className="pending-status-text">Waiting for approval</span>
        </div>
        <button className="pending-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/pending/page.tsx
git commit -m "feat: update pending page to watch org_members"
```

---

## Task 22: Create Org Switcher Component

**Purpose:** Dropdown in the profile badge that shows the user's orgs and allows switching.

**Files:**
- Create: `components/org-switcher.tsx`
- Modify: `components/app-header-auth.tsx:1-72`
- Modify: `app/globals.css` (add org-switcher styles)

- [ ] **Step 1: Create org-switcher.tsx**

Create `components/org-switcher.tsx`:

```typescript
"use client"

import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { switchOrg } from "@/lib/actions/organizations"
import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function OrgSwitcher() {
  const { activeOrgId, userOrgs, refreshOrgs } = useAuth()
  const router = useRouter()

  if (userOrgs.length <= 1) {
    const orgName = userOrgs[0]?.organizations?.name
    if (!orgName) return null
    return <span className="org-switcher-label">{orgName}</span>
  }

  const activeOrg = userOrgs.find((o) => o.org_id === activeOrgId)

  const handleSwitch = async (orgId: string) => {
    if (orgId === activeOrgId) return
    await switchOrg(orgId)
    await refreshOrgs()
    router.push("/home")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="org-switcher-trigger">
        <span>{activeOrg?.organizations?.name}</span>
        <ChevronDown className="org-switcher-chevron" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {userOrgs.map((org) => (
          <DropdownMenuItem
            key={org.org_id}
            onClick={() => handleSwitch(org.org_id)}
            className="org-switcher-item"
          >
            {org.org_id === activeOrgId && (
              <Check className="org-switcher-check" />
            )}
            <span>{org.organizations?.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Update app-header-auth.tsx to include OrgSwitcher**

In `components/app-header-auth.tsx`, add the import and insert the OrgSwitcher inside the dropdown label, replacing the role badge:

Replace the import section (lines 1-16) with:

```typescript
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogIn } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { OrgSwitcher } from "@/components/org-switcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
```

Replace the DropdownMenuLabel contents (lines 52-62) with:

```typescript
            <DropdownMenuLabel className="app-header-auth-label">
              {profile?.display_name && (
                <span>{profile.display_name}</span>
              )}
              <span className="app-header-auth-email">{user?.email}</span>
              <OrgSwitcher />
            </DropdownMenuLabel>
```

- [ ] **Step 3: Add org-switcher styles to globals.css**

Add these styles to `app/globals.css`:

```css
/* Org Switcher */
.org-switcher-label {
  @apply text-xs text-muted-foreground;
}

.org-switcher-trigger {
  @apply flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors;
}

.org-switcher-chevron {
  @apply h-3 w-3;
}

.org-switcher-item {
  @apply flex items-center gap-2 text-sm;
}

.org-switcher-check {
  @apply h-3.5 w-3.5;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/org-switcher.tsx components/app-header-auth.tsx app/globals.css
git commit -m "feat: add org switcher to profile badge"
```

---

## Task 23: Update Admin Layout

**Purpose:** Check org-level admin role instead of profile.role for admin access.

**Files:**
- Modify: `app/(app)/admin/layout.tsx`

- [ ] **Step 1: Read the current admin layout**

Read `app/(app)/admin/layout.tsx` to see the exact current structure.

- [ ] **Step 2: Update admin layout to check org_members**

Replace the auth check logic in the admin layout. The layout should:
1. Get the user via `supabase.auth.getUser()`
2. Get their profile for `active_org_id` and `is_super_admin`
3. Check `org_members` for admin role in active org
4. Allow if org admin OR super admin

```typescript
// Replace the profile/role check with:
const { data: profile } = await supabase
  .from("profiles")
  .select("active_org_id, is_super_admin")
  .eq("id", user.id)
  .single()

if (!profile) {
  redirect("/home")
}

// Super admins always allowed
if (!profile.is_super_admin) {
  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", profile.active_org_id)
    .eq("user_id", user.id)
    .single()

  if (!membership || membership.role !== "admin") {
    redirect("/home")
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(app)/admin/layout.tsx
git commit -m "feat: update admin layout for org-based access control"
```

---

## Task 24: Update Admin Users Page

**Purpose:** Show org-scoped users, approve into current org.

**Files:**
- Modify: `app/(app)/admin/users/page.tsx`

- [ ] **Step 1: Read the current admin users page**

Read `app/(app)/admin/users/page.tsx` to understand the exact current structure and UI.

- [ ] **Step 2: Update data fetching**

The admin users page currently fetches from `profiles`. It must now:
1. Fetch `org_members` for the active org (join with profiles to get user details)
2. Split into pending vs approved (based on org_members.role, not profiles.role)
3. Use the updated `approveUser()` and `updateUserRole()` actions (which now operate on org_members)

Replace the data fetching with:

```typescript
// Fetch the admin's active org
const { data: profile } = await supabase
  .from("profiles")
  .select("active_org_id")
  .eq("id", user.id)
  .single()

// Fetch org members with profile details
const { data: members } = await supabase
  .from("org_members")
  .select("id, user_id, role, approved_at, profiles(id, email, display_name, created_at)")
  .eq("org_id", profile.active_org_id)
  .order("created_at", { ascending: false })
```

- [ ] **Step 3: Update the role dropdown**

The role dropdown currently sets `profiles.role`. It now sets `org_members.role` via the updated `updateUserRole()` action. The action signature is the same (`userId, role`) but it now operates on org_members for the admin's active org.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/admin/users/page.tsx
git commit -m "feat: update admin users page for org-scoped management"
```

---

## Task 25: Create Admin Organizations Page

**Purpose:** Super-admin page for managing organizations.

**Files:**
- Create: `app/(app)/admin/organizations/page.tsx`

- [ ] **Step 1: Create the organizations page**

Create `app/(app)/admin/organizations/page.tsx`:

```typescript
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { createOrganization, assignOrgAdmin } from "@/lib/actions/organizations"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Organization } from "@/lib/types"

export default function OrganizationsPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  useEffect(() => {
    if (!profile?.is_super_admin) return
    const supabase = createClient()
    const fetchOrgs = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false })
      setOrgs(data || [])
    }
    fetchOrgs()
  }, [profile])

  if (!profile?.is_super_admin) {
    return <p>Super admin access required.</p>
  }

  const handleCreate = async () => {
    if (!name || !slug) return
    try {
      await createOrganization({ name, slug: slug.toLowerCase().replace(/\s+/g, "-") })
      setName("")
      setSlug("")
      toast({ title: "Organization created" })
      // Re-fetch
      const supabase = createClient()
      const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: false })
      setOrgs(data || [])
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" })
    }
  }

  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(value.toLowerCase().replace(/\s+/g, "-"))
  }

  return (
    <div className="admin-page">
      <h1 className="admin-page-title">Organizations</h1>

      <div className="admin-card">
        <h2 className="admin-card-title">Create Organization</h2>
        <div className="admin-form-row">
          <Input
            placeholder="Organization name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
          />
          <Input
            placeholder="slug (auto-generated)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
          <Button onClick={handleCreate}>Create</Button>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title">All Organizations</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id}>
                <td>{org.name}</td>
                <td>{org.slug}</td>
                <td>{new Date(org.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add Organizations link to admin nav**

Find the admin navigation component (likely in `app/(app)/admin/layout.tsx` or a separate `AdminNav` component) and add a link to `/admin/organizations`. Only show it when `profile?.is_super_admin` is true.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/admin/organizations/page.tsx
git commit -m "feat: add admin organizations page for super-admin"
```

---

## Task 26: Create Invite System — Join Page

**Purpose:** Create the `/join/[slug]` page where users can join an org via invite link.

**Files:**
- Create: `app/join/[slug]/page.tsx`

- [ ] **Step 1: Create the join page**

Create `app/join/[slug]/page.tsx`:

```typescript
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [orgName, setOrgName] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "joining" | "done" | "error">("loading")
  const [error, setError] = useState("")

  useEffect(() => {
    const supabase = createClient()
    const fetchOrg = async () => {
      const { data } = await supabase
        .from("organizations")
        .select("name")
        .eq("slug", slug)
        .single()

      if (data) {
        setOrgName(data.name)
        setStatus("ready")
      } else {
        setError("Organization not found")
        setStatus("error")
      }
    }
    fetchOrg()
  }, [slug])

  const handleJoin = async () => {
    setStatus("joining")
    const supabase = createClient()

    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      // Redirect to login with return URL
      const returnUrl = `/join/${slug}`
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`,
        },
      })
      return
    }

    // Get org id
    const { data: org } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()

    if (!org) {
      setError("Organization not found")
      setStatus("error")
      return
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("org_members")
      .select("id, role")
      .eq("org_id", org.id)
      .eq("user_id", user.id)
      .single()

    if (existing) {
      if (existing.role === "pending") {
        setStatus("done")
      } else {
        // Already approved — just go to the app
        router.push("/home")
        return
      }
    } else {
      // Create pending membership
      const { error: insertError } = await supabase
        .from("org_members")
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: "pending",
        })

      if (insertError) {
        setError(insertError.message)
        setStatus("error")
        return
      }

      setStatus("done")
    }
  }

  if (status === "loading") {
    return <div className="join-page"><p>Loading...</p></div>
  }

  if (status === "error") {
    return (
      <div className="join-page">
        <div className="join-card">
          <p className="join-error">{error}</p>
        </div>
      </div>
    )
  }

  if (status === "done") {
    return (
      <div className="join-page">
        <div className="join-card">
          <h1 className="join-headline">Request sent</h1>
          <p className="join-body">
            A {orgName} admin will review your request.
            You&apos;ll get access once approved.
          </p>
          <Button onClick={() => router.push("/pending")}>Continue</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="join-page">
      <div className="join-card">
        <div className="join-brand">TRYOUT TRACKER</div>
        <h1 className="join-headline">Join {orgName}</h1>
        <p className="join-body">
          Sign in with Google to request access to {orgName}&apos;s tryout tracker.
        </p>
        <Button onClick={handleJoin} disabled={status === "joining"}>
          {status === "joining" ? "Joining..." : `Join ${orgName}`}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add join page styles to globals.css**

Add to `app/globals.css`:

```css
/* Join page */
.join-page {
  @apply flex min-h-screen items-center justify-center p-4;
}

.join-card {
  @apply flex flex-col items-center gap-4 rounded-sm border-2 border-border/12 bg-card p-8 text-center max-w-md;
}

.join-brand {
  @apply text-xs font-mono tracking-widest text-muted-foreground;
}

.join-headline {
  @apply text-2xl font-heading font-bold;
}

.join-body {
  @apply text-sm text-muted-foreground;
}

.join-error {
  @apply text-sm text-destructive;
}
```

- [ ] **Step 3: Update auth callback to support `next` parameter**

Check `app/auth/callback/route.ts` — if it doesn't already handle a `next` query parameter for redirect-after-login, add support:

```typescript
const next = requestUrl.searchParams.get("next") || "/home"
return NextResponse.redirect(new URL(next, requestUrl.origin))
```

- [ ] **Step 4: Commit**

```bash
git add app/join/ app/globals.css app/auth/callback/route.ts
git commit -m "feat: add invite join page for org onboarding"
```

---

## Task 27: Add QR Code to Admin Invite Section

**Purpose:** Generate a QR code for the org's invite link in the admin section.

**Files:**
- Modify: `app/(app)/admin/users/page.tsx` (add invite section)

- [ ] **Step 1: Install qrcode dependency**

```bash
npm install qrcode
npm install -D @types/qrcode
```

- [ ] **Step 2: Add invite section to admin users page**

At the top of the admin users page, add an invite section that shows:
- The invite link (copyable)
- A QR code image

```typescript
import QRCode from "qrcode"

// Inside the component, generate QR data URL:
const [qrDataUrl, setQrDataUrl] = useState("")
const inviteLink = typeof window !== "undefined"
  ? `${window.location.origin}/join/${orgSlug}`
  : ""

useEffect(() => {
  if (inviteLink) {
    QRCode.toDataURL(inviteLink, { width: 200, margin: 2 }).then(setQrDataUrl)
  }
}, [inviteLink])
```

Add the invite section JSX:

```typescript
<div className="admin-card">
  <h2 className="admin-card-title">Invite Parents</h2>
  <p className="admin-card-desc">Share this link or QR code with parents to let them request access.</p>
  <div className="invite-section">
    <Input value={inviteLink} readOnly />
    <Button onClick={() => navigator.clipboard.writeText(inviteLink)}>
      Copy Link
    </Button>
  </div>
  {qrDataUrl && (
    <img src={qrDataUrl} alt="Invite QR code" className="invite-qr" />
  )}
</div>
```

To get the org slug, fetch it from the current org context:

```typescript
const [orgSlug, setOrgSlug] = useState("")

useEffect(() => {
  const supabase = createClient()
  const fetchOrg = async () => {
    const { data: prof } = await supabase.from("profiles").select("active_org_id").eq("id", user.id).single()
    if (prof?.active_org_id) {
      const { data: org } = await supabase.from("organizations").select("slug").eq("id", prof.active_org_id).single()
      if (org) setOrgSlug(org.slug)
    }
  }
  fetchOrg()
}, [user])
```

- [ ] **Step 3: Add invite styles to globals.css**

```css
.invite-section {
  @apply flex items-center gap-2 w-full;
}

.invite-qr {
  @apply mt-4 rounded-sm border-2 border-border/12;
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(app)/admin/users/page.tsx app/globals.css package.json package-lock.json
git commit -m "feat: add QR code invite system to admin users page"
```

---

## Task 28: Update Schema File

**Purpose:** Keep `lib/supabase/schema.sql` in sync with the actual database for documentation purposes.

**Files:**
- Modify: `lib/supabase/schema.sql`

- [ ] **Step 1: Rewrite schema.sql to reflect the new multi-tenant schema**

The full file should include all the new tables, modified tables, updated functions, updated RLS policies, and updated view. This is the reference schema — not a migration script.

Key changes to include:
- `organizations` table
- `org_members` table
- `profiles` without `role`/`approved_at`, with `is_super_admin`/`active_org_id`
- All data tables with `org_id` column
- Updated unique constraints
- New helper functions (`get_active_org_id`, `get_org_role`, `is_super_admin`)
- Updated `get_user_role()` for backward compat
- All rewritten RLS policies
- Updated `players_view`
- Updated `handle_new_user()` trigger
- Self-insert policy for join flow
- Grants for new tables and functions

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/schema.sql
git commit -m "docs: update schema.sql to reflect multi-tenant schema"
```

---

## Task 29: Fix Build Errors — Client Pages

**Purpose:** Fix any remaining TypeScript errors in client pages that reference `profile.role` or `profile.approved_at`.

**Files:**
- May need modifications in: admin pages, any component referencing `profile.role`

- [ ] **Step 1: Run the build and identify errors**

```bash
npm run build
```

Look for errors referencing:
- `profile.role` — should use `orgRole` from `useAuth()` instead
- `profile.approved_at` — should use org_members data instead
- `Badge` showing role — should show `orgRole` from auth context

- [ ] **Step 2: Fix each error**

For each file with errors:
- Replace `profile.role` with `orgRole` from `useAuth()`
- Replace role checks like `profile.role === 'admin'` with `orgRole === 'admin' || profile?.is_super_admin`
- Update any admin dashboard queries that count by `profiles.role` to count by `org_members.role` scoped to active org

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve all type errors from multi-tenancy migration"
```

---

## Task 30: Wildcats Migration Validation

**Purpose:** Verify all existing Wildcats data is intact and working after the migration.

**Files:** No files — this is manual testing.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify existing user login**

Log in with an existing Wildcats user account. Expected:
- Middleware allows access (active_org_id set, membership exists)
- Profile badge shows "Nepean Wildcats" as org label
- No org dropdown (only one org)

- [ ] **Step 3: Verify data visibility**

Navigate through all main pages:
- `/home` — competition wizard loads players from Wildcats
- `/crew` — existing crew members visible
- `/players` — all Wildcats players visible
- `/current` — sessions visible

- [ ] **Step 4: Verify admin functions**

Log in as admin:
- `/admin` — dashboard shows correct stats
- `/admin/players` — all Wildcats players listed
- `/admin/users` — org members shown (not global profiles)
- `/admin/sessions` — sessions visible and editable
- `/admin/rounds` — rounds visible

- [ ] **Step 5: Verify super-admin flag**

In Supabase SQL Editor, set your account as super-admin:

```sql
update profiles set is_super_admin = true where email = 'YOUR_EMAIL';
```

Log in again. Expected: `/admin/organizations` page accessible.

- [ ] **Step 6: Document any issues**

If any issues found, document them and create fix tasks.

---

## Task 31: Ottawa Ice Data Import & Validation

**Purpose:** Create the Ottawa Ice organization, import their data, and validate full isolation.

**Files:** No code changes — operational steps using the app.

- [ ] **Step 1: Create Ottawa Ice organization**

As super-admin, go to `/admin/organizations`:
- Name: "Ottawa Ice"
- Slug: "ottawa-ice"
- Click Create

- [ ] **Step 2: Assign Ottawa Ice admin**

Either create a new user account or designate an existing one. In Supabase SQL Editor:

```sql
-- If using an existing user, get their profile id first
select id, email from profiles where email = 'OTTAWA_ICE_ADMIN_EMAIL';

-- Then use the assignOrgAdmin action from the app, or manually:
insert into org_members (org_id, user_id, role, approved_at)
values (
  (select id from organizations where slug = 'ottawa-ice'),
  'USER_ID_HERE',
  'admin',
  now()
);

-- Set their active org to Ottawa Ice
update profiles
set active_org_id = (select id from organizations where slug = 'ottawa-ice')
where id = 'USER_ID_HERE';
```

- [ ] **Step 3: Prepare the CSV from Google Sheet**

Export the Ottawa Ice Google Sheet as CSV. Ensure columns match:
- `number` (required) — jersey number
- `first_name` (required)
- `last_name` (required)
- `position` (optional) — F / D / G
- `birth_year` (optional)
- `previous_team` (optional)
- `entry_level` (optional)
- `current_level` (optional)

- [ ] **Step 4: Import via admin UI**

Log in as Ottawa Ice admin → go to `/admin/import` → upload the CSV.

Expected: all players imported with `org_id = ottawa_ice_id`.

- [ ] **Step 5: Validate data isolation**

Test matrix:
- [ ] Log in as Wildcats parent → zero Ottawa Ice data visible on any page
- [ ] Log in as Ottawa Ice admin → zero Wildcats data visible on any page
- [ ] Log in as super-admin → can switch between orgs via profile badge dropdown
- [ ] Test crew: add player from active org, verify it's scoped correctly
- [ ] Test invite link: visit `/join/ottawa-ice` as a new user, verify pending flow works

- [ ] **Step 6: Test org switching (super-admin)**

As super-admin (who belongs to both orgs):
1. Profile badge shows dropdown with both orgs
2. Switch to Ottawa Ice → redirected to home, see Ottawa Ice data
3. Switch to Wildcats → redirected to home, see Wildcats data
4. Crew is separate per org

- [ ] **Step 7: Test QR code**

From Ottawa Ice admin → `/admin/users`:
1. Invite link shown with `/join/ottawa-ice`
2. QR code renders
3. Scanning QR opens the join page correctly
