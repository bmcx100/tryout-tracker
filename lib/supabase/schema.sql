-- ========================================
-- Cabot Tryout Crew Tracker — Database Schema
-- Run this in one shot in Supabase SQL Editor
-- ========================================

-- ========================================
-- PROFILES (must be created before get_user_role)
-- ========================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  role text not null default 'pending' check (role in ('pending', 'lite', 'full', 'admin')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ========================================
-- PLAYERS
-- ========================================

create table public.players (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  first_name text,
  last_name text,
  previous_team text,
  position text,
  birth_year int,
  notes text,
  previous_level text check (previous_level in ('AA', 'A', 'BB', 'B', 'C')),
  entry_level text check (entry_level in ('AA', 'A', 'BB', 'B', 'C')),
  current_level text check (current_level in ('AA', 'A', 'BB', 'B', 'C')),
  status text not null default 'active_tryout' check (status in ('active_tryout', 'cut_to_next_level', 'placed_on_team', 'withdrawn')),
  team_placed text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========================================
-- SESSIONS (ice times)
-- ========================================

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('AA', 'A', 'BB', 'B', 'C')),
  round_number int not null,
  group_number int not null check (group_number between 1 and 4),
  date date not null,
  start_time time not null,
  end_time time not null,
  rink text not null,
  notes text
);

-- ========================================
-- SESSION_PLAYERS (junction)
-- ========================================

create table public.session_players (
  session_id uuid references public.sessions on delete cascade,
  player_number int references public.players(number) on delete cascade,
  primary key (session_id, player_number)
);

-- ========================================
-- ROUNDS
-- ========================================

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  level text not null check (level in ('AA', 'A', 'BB', 'B', 'C')),
  round_number int not null,
  date date not null,
  notes text,
  unique (level, round_number)
);

-- ========================================
-- ROUND_RESULTS
-- ========================================

create table public.round_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.rounds on delete cascade not null,
  player_number int references public.players(number) on delete cascade not null,
  result text not null check (result in ('advanced', 'cut_down', 'withdrawn', 'placed')),
  notes text
);

-- ========================================
-- USER_CREW (core table — fully private per user)
-- ========================================

create table public.user_crew (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  player_number int references public.players(number) on delete cascade not null,
  personal_name text not null,
  tag text not null check (tag in ('bff', 'teammate', 'old_teammate', 'friend')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, player_number)
);

-- ========================================
-- CORRECTIONS
-- ========================================

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  player_number int,
  entity_type text not null check (entity_type in ('player', 'session', 'round')),
  entity_id uuid not null,
  field text not null,
  current_value text not null,
  suggested_value text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text
);

-- ========================================
-- NOW safe to create helper function (profiles exists)
-- ========================================

create or replace function public.get_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid()
$$ language sql security definer stable;

-- ========================================
-- RLS POLICIES (all tables exist, function exists)
-- ========================================

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.get_user_role() = 'admin');

-- Players
alter table public.players enable row level security;

create policy "Approved users can read players"
  on public.players for select
  using (public.get_user_role() in ('lite', 'full', 'admin'));

create policy "Admins can insert players"
  on public.players for insert
  with check (public.get_user_role() = 'admin');

create policy "Admins can update players"
  on public.players for update
  using (public.get_user_role() = 'admin');

create policy "Admins can delete players"
  on public.players for delete
  using (public.get_user_role() = 'admin');

-- View that hides real_name from lite users
create or replace view public.players_view as
  select
    id, number,
    case when public.get_user_role() in ('full', 'admin') then first_name else null end as first_name,
    case when public.get_user_role() in ('full', 'admin') then last_name else null end as last_name,
    previous_team, position, birth_year, notes,
    previous_level, entry_level, current_level,
    status, team_placed, created_at, updated_at
  from public.players;

-- Sessions
alter table public.sessions enable row level security;

create policy "Approved users can read sessions"
  on public.sessions for select
  using (public.get_user_role() in ('lite', 'full', 'admin'));

create policy "Admins can manage sessions"
  on public.sessions for all
  using (public.get_user_role() = 'admin');

-- Session Players
alter table public.session_players enable row level security;

create policy "Approved users can read session_players"
  on public.session_players for select
  using (public.get_user_role() in ('lite', 'full', 'admin'));

create policy "Admins can manage session_players"
  on public.session_players for all
  using (public.get_user_role() = 'admin');

-- Rounds
alter table public.rounds enable row level security;

create policy "Approved users can read rounds"
  on public.rounds for select
  using (public.get_user_role() in ('lite', 'full', 'admin'));

create policy "Admins can manage rounds"
  on public.rounds for all
  using (public.get_user_role() = 'admin');

-- Round Results
alter table public.round_results enable row level security;

create policy "Approved users can read round_results"
  on public.round_results for select
  using (public.get_user_role() in ('lite', 'full', 'admin'));

create policy "Admins can manage round_results"
  on public.round_results for all
  using (public.get_user_role() = 'admin');

-- User Crew
alter table public.user_crew enable row level security;

create policy "Users can read own crew"
  on public.user_crew for select
  using (auth.uid() = user_id);

create policy "Users can insert own crew"
  on public.user_crew for insert
  with check (auth.uid() = user_id);

create policy "Users can update own crew"
  on public.user_crew for update
  using (auth.uid() = user_id);

create policy "Users can delete own crew"
  on public.user_crew for delete
  using (auth.uid() = user_id);

-- Corrections
alter table public.corrections enable row level security;

create policy "Users can read own corrections"
  on public.corrections for select
  using (auth.uid() = user_id);

create policy "Users can insert corrections"
  on public.corrections for insert
  with check (auth.uid() = user_id);

create policy "Admins can read all corrections"
  on public.corrections for select
  using (public.get_user_role() = 'admin');

create policy "Admins can update corrections"
  on public.corrections for update
  using (public.get_user_role() = 'admin');

-- ========================================
-- TABLE-LEVEL GRANTS (required for newer Supabase projects)
-- RLS controls row access; GRANTs control table access
-- ========================================

grant usage on schema public to anon, authenticated;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select, insert, update, delete on public.players to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.session_players to authenticated;
grant select, insert, update, delete on public.rounds to authenticated;
grant select, insert, update, delete on public.round_results to authenticated;
grant select, insert, update, delete on public.user_crew to authenticated;
grant select, insert, update on public.corrections to authenticated;

grant select on public.players_view to authenticated;

grant execute on function public.get_user_role() to authenticated;
grant execute on function public.handle_new_user() to authenticated;
