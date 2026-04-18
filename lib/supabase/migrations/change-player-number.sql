-- RPC function to change a player's jersey number.
-- Handles merging when the target number is already taken by a placeholder.
-- Uses SECURITY DEFINER to bypass RLS on user_crew (private per user).
-- Runs as a single transaction — all or nothing.

CREATE OR REPLACE FUNCTION change_player_number(
  p_player_id uuid,
  p_old_number int,
  p_new_number int
) RETURNS uuid AS $$
DECLARE
  v_org_id uuid;
  v_conflict_id uuid;
  v_real record;
BEGIN
  -- Get org
  SELECT org_id INTO v_org_id FROM players WHERE id = p_player_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Player not found';
  END IF;

  -- Check for conflicting player at the target number
  SELECT id INTO v_conflict_id FROM players
    WHERE org_id = v_org_id AND number = p_new_number AND id != p_player_id;

  IF v_conflict_id IS NULL THEN
    -- ==========================================
    -- NO CONFLICT: simple rename
    -- ==========================================

    -- Save + delete FK-linked records, update player, re-insert
    CREATE TEMP TABLE _sp ON COMMIT DROP AS
      SELECT session_id, org_id FROM session_players
      WHERE org_id = v_org_id AND player_number = p_old_number;

    CREATE TEMP TABLE _rr ON COMMIT DROP AS
      SELECT round_id, org_id, result, notes FROM round_results
      WHERE org_id = v_org_id AND player_number = p_old_number;

    CREATE TEMP TABLE _uc ON COMMIT DROP AS
      SELECT id, org_id, user_id, personal_name, tag, notes, created_at, updated_at FROM user_crew
      WHERE org_id = v_org_id AND player_number = p_old_number;

    DELETE FROM session_players WHERE org_id = v_org_id AND player_number = p_old_number;
    DELETE FROM round_results WHERE org_id = v_org_id AND player_number = p_old_number;
    DELETE FROM user_crew WHERE org_id = v_org_id AND player_number = p_old_number;
    UPDATE corrections SET player_number = p_new_number
      WHERE org_id = v_org_id AND player_number = p_old_number;

    UPDATE players SET number = p_new_number, updated_at = now() WHERE id = p_player_id;

    INSERT INTO session_players (session_id, player_number, org_id)
      SELECT session_id, p_new_number, org_id FROM _sp;

    INSERT INTO round_results (round_id, player_number, org_id, result, notes)
      SELECT round_id, p_new_number, org_id, result, notes FROM _rr;

    INSERT INTO user_crew (id, org_id, user_id, player_number, personal_name, tag, notes, created_at, updated_at)
      SELECT id, org_id, user_id, p_new_number, personal_name, tag, notes, created_at, updated_at FROM _uc;

  ELSE
    -- ==========================================
    -- CONFLICT: merge placeholder into real player
    -- ==========================================

    -- Save real player's data
    SELECT first_name, last_name, previous_team, position, birth_year, notes,
      entry_level, current_level, status, team_placed, info_confirmed, checked_in
    INTO v_real FROM players WHERE id = p_player_id;

    -- Merge session_players: keep all unique sessions from both numbers
    -- Delete old number's sessions that overlap with new number (new wins)
    DELETE FROM session_players
      WHERE org_id = v_org_id AND player_number = p_old_number
      AND session_id IN (
        SELECT session_id FROM session_players
        WHERE org_id = v_org_id AND player_number = p_new_number
      );
    -- Move remaining old sessions to new number
    UPDATE session_players SET player_number = p_new_number
      WHERE org_id = v_org_id AND player_number = p_old_number;

    -- Merge round_results: same approach
    DELETE FROM round_results
      WHERE org_id = v_org_id AND player_number = p_old_number
      AND round_id IN (
        SELECT round_id FROM round_results
        WHERE org_id = v_org_id AND player_number = p_new_number
      );
    UPDATE round_results SET player_number = p_new_number
      WHERE org_id = v_org_id AND player_number = p_old_number;

    -- Merge user_crew: delete placeholder entries where user also tracks real player
    DELETE FROM user_crew
      WHERE org_id = v_org_id AND player_number = p_new_number
      AND user_id IN (
        SELECT user_id FROM user_crew
        WHERE org_id = v_org_id AND player_number = p_old_number
      );
    -- Move remaining real player crew to new number
    UPDATE user_crew SET player_number = p_new_number
      WHERE org_id = v_org_id AND player_number = p_old_number;

    -- Merge corrections
    UPDATE corrections SET player_number = p_new_number
      WHERE org_id = v_org_id AND player_number = p_old_number;

    -- Delete old player (all FK refs cleared above)
    DELETE FROM players WHERE id = p_player_id;

    -- Overwrite placeholder with real player's data
    UPDATE players SET
      first_name = v_real.first_name,
      last_name = v_real.last_name,
      previous_team = v_real.previous_team,
      position = v_real.position,
      birth_year = v_real.birth_year,
      notes = v_real.notes,
      entry_level = v_real.entry_level,
      current_level = v_real.current_level,
      status = v_real.status,
      team_placed = v_real.team_placed,
      info_confirmed = v_real.info_confirmed,
      checked_in = v_real.checked_in,
      updated_at = now()
    WHERE id = v_conflict_id;
  END IF;

  -- Return the surviving player's ID
  RETURN COALESCE(v_conflict_id, p_player_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
