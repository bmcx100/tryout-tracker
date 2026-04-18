-- ========================================
-- STEP 1: VERIFICATION — Run this first to confirm the data looks right
-- ========================================

-- Show existing players we're going to reassign (should have names, previous_team, birth_year, etc.)
SELECT 'EXISTING PLAYER' as record_type, number, first_name, last_name, previous_team, position, birth_year, entry_level, current_level, status
FROM players
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND (
    (lower(first_name) = 'taryn'     AND lower(last_name) = 'taniguchi')
    OR (lower(first_name) = 'jessa'    AND lower(last_name) = 'tracey')
    OR (lower(first_name) = 'paige'    AND lower(last_name) = 'vandyk')
    OR (lower(first_name) = 'charlotte' AND lower(last_name) = 'vandyk')
    OR (lower(first_name) = 'piper'    AND lower(last_name) = 'craig')
    OR (lower(first_name) = 'emme'     AND lower(last_name) = 'simmons')
  )
ORDER BY last_name, first_name;

-- Show the blank entries for the new jersey numbers (should have NULL or empty names)
SELECT 'NEW NUMBER (BLANK)' as record_type, number, first_name, last_name, previous_team, position, birth_year, entry_level, current_level, status
FROM players
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND number IN (160, 503, 797, 166, 672, 709)
ORDER BY number;

-- Show which AA sessions these new numbers are already assigned to
SELECT sp.player_number, s.id as session_id, s.level, s.round_number, s.group_number, s.date, s.start_time, s.rink
FROM session_players sp
JOIN sessions s ON s.id = sp.session_id
WHERE sp.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND sp.player_number IN (160, 503, 797, 166, 672, 709)
ORDER BY sp.player_number, s.date, s.start_time;


-- ========================================
-- STEP 2: MIGRATION — Run this AFTER verifying Step 1 looks correct
-- ========================================

BEGIN;

-- Define the mapping: (first_name, last_name) -> new_number
-- We'll use a temporary table for clean lookups
CREATE TEMP TABLE jersey_reassignments (
  first_name text,
  last_name text,
  new_number int
) ON COMMIT DROP;

INSERT INTO jersey_reassignments (first_name, last_name, new_number) VALUES
  ('Taryn',     'Taniguchi', 160),
  ('Jessa',     'Tracey',    503),
  ('Paige',     'Vandyk',    797),
  ('Charlotte', 'Vandyk',    166),
  ('Piper',     'Craig',     672),
  ('Emme',      'Simmons',   709);

-- Build a lookup of old numbers for each player
CREATE TEMP TABLE player_mapping AS
SELECT
  jr.first_name,
  jr.last_name,
  jr.new_number,
  p.number AS old_number,
  p.id AS old_player_id
FROM jersey_reassignments jr
JOIN players p
  ON p.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND lower(p.first_name) = lower(jr.first_name)
  AND lower(p.last_name) = lower(jr.last_name)
  AND p.number != jr.new_number;

-- Sanity check: show what we found (this will appear in the query results)
SELECT '>>> MAPPING' as step, first_name, last_name, old_number, new_number FROM player_mapping ORDER BY last_name;

-- ----------------------------------------
-- 2a. Copy player info from old record to new (blank) record
-- ----------------------------------------
UPDATE players AS target
SET
  first_name    = source.first_name,
  last_name     = source.last_name,
  previous_team = source.previous_team,
  position      = source.position,
  birth_year    = source.birth_year,
  notes         = source.notes,
  entry_level   = COALESCE(target.entry_level, source.entry_level),
  current_level = COALESCE(target.current_level, source.current_level),
  info_confirmed = source.info_confirmed,
  status        = source.status,
  updated_at    = now()
FROM player_mapping pm
JOIN players source
  ON source.id = pm.old_player_id
WHERE target.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND target.number = pm.new_number;

-- ----------------------------------------
-- 2b. Move session_players from old number to new number
--     (skip if new number already exists in that session)
-- ----------------------------------------
UPDATE session_players sp_old
SET player_number = pm.new_number
FROM player_mapping pm
WHERE sp_old.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND sp_old.player_number = pm.old_number
  AND NOT EXISTS (
    SELECT 1 FROM session_players sp_new
    WHERE sp_new.session_id = sp_old.session_id
      AND sp_new.player_number = pm.new_number
  );

-- Delete any remaining old session_players that couldn't be moved (duplicates)
DELETE FROM session_players
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND player_number IN (SELECT old_number FROM player_mapping);

-- ----------------------------------------
-- 2c. Move round_results from old number to new number
-- ----------------------------------------
UPDATE round_results
SET player_number = pm.new_number
FROM player_mapping pm
WHERE round_results.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND round_results.player_number = pm.old_number;

-- ----------------------------------------
-- 2d. Move user_crew from old number to new number
--     (skip if user already has crew entry for new number)
-- ----------------------------------------
UPDATE user_crew uc_old
SET player_number = pm.new_number
FROM player_mapping pm
WHERE uc_old.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND uc_old.player_number = pm.old_number
  AND NOT EXISTS (
    SELECT 1 FROM user_crew uc_new
    WHERE uc_new.org_id = uc_old.org_id
      AND uc_new.user_id = uc_old.user_id
      AND uc_new.player_number = pm.new_number
  );

-- Delete any remaining old user_crew that couldn't be moved
DELETE FROM user_crew
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND player_number IN (SELECT old_number FROM player_mapping);

-- ----------------------------------------
-- 2e. Move corrections from old number to new number
-- ----------------------------------------
UPDATE corrections
SET player_number = pm.new_number
FROM player_mapping pm
WHERE corrections.org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND corrections.player_number = pm.old_number;

-- ----------------------------------------
-- 2f. Delete the old player records
-- ----------------------------------------
DELETE FROM players
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND id IN (SELECT old_player_id FROM player_mapping);

-- ----------------------------------------
-- 2g. Final verification — show the updated records
-- ----------------------------------------
SELECT '>>> FINAL RESULT' as step, number, first_name, last_name, previous_team, position, birth_year, entry_level, current_level, status
FROM players
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND number IN (160, 503, 797, 166, 672, 709)
ORDER BY number;

-- Confirm old numbers are gone
SELECT '>>> OLD NUMBERS REMAINING' as step, count(*) as should_be_zero
FROM players
WHERE org_id = '521dd815-0e9e-49a2-b211-f3b892f5b12c'
  AND id IN (SELECT old_player_id FROM player_mapping);

COMMIT;
