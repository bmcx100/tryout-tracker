-- ========================================
-- Cabot Tryout Crew Tracker — Multi-Tenant Database Schema
-- Reference schema — represents the final state of the database.
-- Not a migration script.
-- ========================================

-- ========================================
-- ORGANIZATIONS
-- ========================================

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
)

-- ========================================
-- PROFILES (must be created before helper functions)
-- ========================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  is_super_admin boolean not null default false,
  active_org_id uuid references public.organizations(id),
  created_at timestamptz not null default now()
)

-- ========================================
-- ORG_MEMBERS (junction: users <-> organizations)
-- ========================================

create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null default 'pending' check (role in ('pending', 'lite', 'full', 'admin')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
)

-- ========================================
-- Auto-create profile on signup
-- ========================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_org_id uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');

  select id into default_org_id
  from public.organizations
  where is_default = true
  limit 1;

  if default_org_id is not null then
    insert into public.org_members (org_id, user_id, role)
    values (default_org_id, new.id, 'pending');

    update public.profiles
    set active_org_id = default_org_id
    where id = new.id;
  end if;

  return new;
end;
$$ language plpgsql security definer

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user()

-- ========================================
-- PLAYERS
-- ========================================

create table public.players (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  number int not null,
  first_name text,
  last_name text,
  previous_team text,
  position text,
  birth_year int,
  notes text,
  entry_level text check (entry_level in ('AA', 'A', 'BB', 'B', 'C')),
  current_level text check (current_level in ('AA', 'A', 'BB', 'B', 'C')),
  info_confirmed boolean not null default false,
  checked_in boolean not null default false,
  status text not null default 'active_tryout' check (status in ('active_tryout', 'cut_to_next_level', 'placed_on_team', 'withdrawn')),
  team_placed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, number)
)

-- ========================================
-- SESSIONS (ice times)
-- ========================================

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  level text not null check (level in ('AA', 'A', 'BB', 'B', 'C')),
  round_number int not null,
  group_number int not null check (group_number between 1 and 4),
  date date not null,
  start_time time not null,
  end_time time not null,
  rink text not null,
  notes text
)

-- ========================================
-- SESSION_PLAYERS (junction)
-- ========================================

create table public.session_players (
  session_id uuid references public.sessions on delete cascade,
  player_number int not null,
  org_id uuid references public.organizations(id) on delete cascade not null,
  primary key (session_id, player_number)
)

-- ========================================
-- ROUNDS
-- ========================================

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  level text not null check (level in ('AA', 'A', 'BB', 'B', 'C')),
  round_number int not null,
  date date not null,
  notes text,
  unique (org_id, level, round_number)
)

-- ========================================
-- ROUND_RESULTS
-- ========================================

create table public.round_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  round_id uuid references public.rounds on delete cascade not null,
  player_number int not null,
  result text not null check (result in ('advanced', 'cut_down', 'withdrawn', 'placed')),
  notes text
)

-- ========================================
-- USER_CREW (core table — fully private per user, scoped to org)
-- ========================================

create table public.user_crew (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  player_number int not null,
  personal_name text not null,
  tag text not null check (tag in ('bff', 'teammate', 'old_teammate', 'friend')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, player_number)
)

-- ========================================
-- CORRECTIONS
-- ========================================

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  player_number int,
  entity_type text not null check (entity_type in ('player', 'session', 'round')),
  entity_id uuid not null,
  field text not null,
  current_value text not null,
  suggested_value text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text
)

-- ========================================
-- USER SCENARIOS (saved scenario builder states)
-- ========================================

create table public.user_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  description text,
  scenario_data jsonb not null default '{}',
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, name)
)

-- ========================================
-- USER_COMPETITION_PREFS (per-user team/player sort order)
-- ========================================

create table public.user_competition_prefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  position_group text not null default 'forwards',
  team_order text[] not null default '{}',
  player_order jsonb not null default '{}',
  pinned_players jsonb not null default '{}',
  team_slots jsonb not null default '{}',
  position_overrides jsonb not null default '{}',
  last_viewed timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, position_group)
)

-- ========================================
-- PRE-APPROVED EMAILS (admin pre-approves before signup)
-- ========================================

create table public.pre_approved_emails (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade not null,
  email text not null,
  role text not null default 'lite' check (role in ('lite', 'full', 'admin')),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, email)
)

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Returns the active_org_id for the current user
create or replace function public.get_active_org_id()
returns uuid as $$
  select active_org_id from public.profiles where id = auth.uid()
$$ language sql security definer stable

-- Returns the user's role within the given org
create or replace function public.get_org_role(target_org_id uuid)
returns text as $$
  select role from public.org_members
  where org_id = target_org_id and user_id = auth.uid()
$$ language sql security definer stable

-- Returns whether the current user is a super admin
create or replace function public.is_super_admin()
returns boolean as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  )
$$ language sql security definer stable

-- Legacy helper — returns org role within active org
create or replace function public.get_user_role()
returns text as $$
  select role from public.org_members
  where org_id = (select active_org_id from public.profiles where id = auth.uid())
    and user_id = auth.uid()
$$ language sql security definer stable

-- ========================================
-- VIEW: players_view (hides real names from lite users)
-- ========================================

create or replace view public.players_view as
  select
    id, org_id, number,
    case
      when public.is_super_admin() then first_name
      when public.get_org_role(org_id) in ('full', 'admin') then first_name
      else null
    end as first_name,
    case
      when public.is_super_admin() then last_name
      when public.get_org_role(org_id) in ('full', 'admin') then last_name
      else null
    end as last_name,
    previous_team, position, birth_year, notes,
    entry_level, current_level,
    info_confirmed, checked_in,
    status, team_placed, created_at, updated_at
  from public.players

-- ========================================
-- RLS POLICIES
-- ========================================

-- --- Organizations ---
alter table public.organizations enable row level security

create policy "Anyone can read organizations"
  on public.organizations for select
  using (true)

create policy "Super admins can insert organizations"
  on public.organizations for insert
  with check (public.is_super_admin())

create policy "Super admins can update organizations"
  on public.organizations for update
  using (public.is_super_admin())

create policy "Super admins can delete organizations"
  on public.organizations for delete
  using (public.is_super_admin())

-- --- Org Members ---
alter table public.org_members enable row level security

create policy "Users can read own memberships"
  on public.org_members for select
  using (auth.uid() = user_id)

create policy "Org admins can read org memberships"
  on public.org_members for select
  using (public.get_org_role(org_id) = 'admin')

create policy "Super admins can read all memberships"
  on public.org_members for select
  using (public.is_super_admin())

create policy "Users can insert own pending membership"
  on public.org_members for insert
  with check (auth.uid() = user_id and role = 'pending')

create policy "Org admins can update org memberships"
  on public.org_members for update
  using (public.get_org_role(org_id) = 'admin')

create policy "Super admins can update all memberships"
  on public.org_members for update
  using (public.is_super_admin())

create policy "Org admins can delete org memberships"
  on public.org_members for delete
  using (public.get_org_role(org_id) = 'admin')

create policy "Super admins can delete all memberships"
  on public.org_members for delete
  using (public.is_super_admin())

create policy "Super admins can insert memberships"
  on public.org_members for insert
  with check (public.is_super_admin())

-- --- Profiles ---
alter table public.profiles enable row level security

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id)

create policy "Org admins can read profiles in their org"
  on public.profiles for select
  using (
    exists (
      select 1 from public.org_members om
      where om.user_id = profiles.id
        and public.get_org_role(om.org_id) = 'admin'
    )
  )

create policy "Super admins can read all profiles"
  on public.profiles for select
  using (public.is_super_admin())

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)

create policy "Super admins can update all profiles"
  on public.profiles for update
  using (public.is_super_admin())

-- --- Players ---
alter table public.players enable row level security

create policy "Approved users can read players in their org"
  on public.players for select
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  )

create policy "Admins can insert players"
  on public.players for insert
  with check (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can update players"
  on public.players for update
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can delete players"
  on public.players for delete
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

-- --- Sessions ---
alter table public.sessions enable row level security

create policy "Approved users can read sessions in their org"
  on public.sessions for select
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  )

create policy "Admins can insert sessions"
  on public.sessions for insert
  with check (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can update sessions"
  on public.sessions for update
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can delete sessions"
  on public.sessions for delete
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

-- --- Session Players ---
alter table public.session_players enable row level security

create policy "Approved users can read session_players in their org"
  on public.session_players for select
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  )

create policy "Admins can insert session_players"
  on public.session_players for insert
  with check (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can update session_players"
  on public.session_players for update
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can delete session_players"
  on public.session_players for delete
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

-- --- Rounds ---
alter table public.rounds enable row level security

create policy "Approved users can read rounds in their org"
  on public.rounds for select
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  )

create policy "Admins can insert rounds"
  on public.rounds for insert
  with check (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can update rounds"
  on public.rounds for update
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can delete rounds"
  on public.rounds for delete
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

-- --- Round Results ---
alter table public.round_results enable row level security

create policy "Approved users can read round_results in their org"
  on public.round_results for select
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) in ('lite', 'full', 'admin'))
    or public.is_super_admin()
  )

create policy "Admins can insert round_results"
  on public.round_results for insert
  with check (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can update round_results"
  on public.round_results for update
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can delete round_results"
  on public.round_results for delete
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

-- --- User Crew ---
alter table public.user_crew enable row level security

create policy "Users can read own crew in active org"
  on public.user_crew for select
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can insert own crew in active org"
  on public.user_crew for insert
  with check (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can update own crew in active org"
  on public.user_crew for update
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can delete own crew in active org"
  on public.user_crew for delete
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

-- --- User Scenarios ---
alter table public.user_scenarios enable row level security

create policy "Users can read own or shared scenarios in active org"
  on public.user_scenarios for select
  using (
    org_id = public.get_active_org_id()
    and (auth.uid() = user_id or is_shared = true)
  )

create policy "Users can insert own scenarios in active org"
  on public.user_scenarios for insert
  with check (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can update own scenarios in active org"
  on public.user_scenarios for update
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can delete own scenarios in active org"
  on public.user_scenarios for delete
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

-- --- Corrections ---
alter table public.corrections enable row level security

create policy "Users can read own corrections in active org"
  on public.corrections for select
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can insert corrections in active org"
  on public.corrections for insert
  with check (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Admins can read all corrections in their org"
  on public.corrections for select
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

create policy "Admins can update corrections in their org"
  on public.corrections for update
  using (
    (org_id = public.get_active_org_id() and public.get_org_role(org_id) = 'admin')
    or public.is_super_admin()
  )

-- --- User Competition Prefs ---
alter table public.user_competition_prefs enable row level security

create policy "Users can read own competition prefs in active org"
  on public.user_competition_prefs for select
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can insert own competition prefs in active org"
  on public.user_competition_prefs for insert
  with check (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can update own competition prefs in active org"
  on public.user_competition_prefs for update
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

create policy "Users can delete own competition prefs in active org"
  on public.user_competition_prefs for delete
  using (auth.uid() = user_id and org_id = public.get_active_org_id())

-- --- Pre-Approved Emails ---
alter table public.pre_approved_emails enable row level security

create policy "Org admins can read pre-approved emails"
  on public.pre_approved_emails for select
  using (
    public.get_org_role(org_id) = 'admin'
    or public.is_super_admin()
  )

create policy "Org admins can insert pre-approved emails"
  on public.pre_approved_emails for insert
  with check (
    public.get_org_role(org_id) = 'admin'
    or public.is_super_admin()
  )

create policy "Org admins can delete pre-approved emails"
  on public.pre_approved_emails for delete
  using (
    public.get_org_role(org_id) = 'admin'
    or public.is_super_admin()
  )

-- Authenticated users can check if their own email is pre-approved (for join flow)
-- Uses auth.jwt() instead of querying auth.users (authenticated role lacks access to that table)
create policy "Users can check own pre-approval"
  on public.pre_approved_emails for select
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
  )

-- ========================================
-- FUNCTION: join_org_pre_approved (security definer)
-- Allows a pre-approved user to join with their approved role,
-- bypassing the RLS policy that only allows 'pending' inserts.
-- ========================================

create or replace function public.join_org_pre_approved(
  target_org_id uuid,
  target_role text
)
returns void as $$
declare
  caller_email text;
  pre_approved_row record;
begin
  -- Get the caller's email
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    raise exception 'Not authenticated';
  end if;

  -- Verify the caller is actually pre-approved for this org with this role
  select * into pre_approved_row from public.pre_approved_emails
  where org_id = target_org_id
    and lower(email) = lower(caller_email);

  if pre_approved_row is null then
    raise exception 'Email is not pre-approved for this organization';
  end if;

  if pre_approved_row.role != target_role then
    raise exception 'Role mismatch with pre-approval';
  end if;

  -- Insert the org_members row with the approved role
  insert into public.org_members (org_id, user_id, role, approved_at)
  values (target_org_id, auth.uid(), target_role, now());

  -- Set active_org_id if not already set
  update public.profiles
  set active_org_id = target_org_id
  where id = auth.uid() and active_org_id is null;

  -- Delete the pre-approved entry (consumed)
  delete from public.pre_approved_emails
  where id = pre_approved_row.id;
end;
$$ language plpgsql security definer

-- ========================================
-- AUTH ERRORS (diagnostic logging)
-- ========================================

create table public.auth_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  email text,
  phase text not null,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
)

-- --- Auth Errors RLS ---
alter table public.auth_errors enable row level security

create policy "Anyone can insert auth errors"
  on public.auth_errors for insert
  with check (true)

create policy "Admins can read auth errors"
  on public.auth_errors for select
  using (public.is_super_admin())

-- ========================================
-- TABLE-LEVEL GRANTS
-- RLS controls row access; GRANTs control table access
-- ========================================

grant usage on schema public to anon, authenticated

-- Organizations: readable by anyone (for /join page), managed by authenticated
grant select on public.organizations to anon, authenticated
grant insert, update, delete on public.organizations to authenticated

-- Org Members
grant select, insert, update, delete on public.org_members to authenticated

-- Profiles
grant select on public.profiles to authenticated
grant update on public.profiles to authenticated

-- Data tables
grant select, insert, update, delete on public.players to authenticated
grant select, insert, update, delete on public.sessions to authenticated
grant select, insert, update, delete on public.session_players to authenticated
grant select, insert, update, delete on public.rounds to authenticated
grant select, insert, update, delete on public.round_results to authenticated
grant select, insert, update, delete on public.user_crew to authenticated
grant select, insert, update, delete on public.user_scenarios to authenticated
grant select, insert, update on public.corrections to authenticated
grant select, insert, update, delete on public.user_competition_prefs to authenticated
grant select, insert, delete on public.pre_approved_emails to authenticated

-- View
grant select on public.players_view to authenticated

-- Functions
grant execute on function public.get_user_role() to authenticated
grant execute on function public.get_active_org_id() to authenticated
grant execute on function public.get_org_role(uuid) to authenticated
grant execute on function public.is_super_admin() to authenticated
grant execute on function public.handle_new_user() to authenticated
grant execute on function public.join_org_pre_approved(uuid, text) to authenticated

-- Auth errors: insert from anyone (user may not be fully authed), read by authenticated (RLS limits to admins)
grant insert on public.auth_errors to anon, authenticated
grant select on public.auth_errors to authenticated
