-- ============================================
-- CONDITIONS DE VALIDATION SIMPLES ET FIXES
-- ============================================
-- Conditions fixes pour tous les défis :
-- - 1 km minimum
-- - 5 minutes minimum
-- ============================================

-- Mise à jour de la fonction pour utiliser des conditions fixes
CREATE OR REPLACE FUNCTION calculate_challenge_rankings(
  p_challenge_id UUID
)
RETURNS TABLE (
  user_id UUID,
  total_distance NUMERIC,
  total_rides INTEGER,
  max_speed NUMERIC,
  total_duration NUMERIC,
  rank INTEGER
) AS $$
DECLARE
  v_challenge_type TEXT;
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
  v_min_distance NUMERIC := 1000;  -- 1 km en mètres (fixe pour tous)
  v_min_duration INTEGER := 300;   -- 5 minutes en secondes (fixe pour tous)
BEGIN
  -- Récupérer les infos du défi
  SELECT type, start_date, end_date
  INTO v_challenge_type, v_start_date, v_end_date
  FROM challenges
  WHERE id = p_challenge_id;

  IF v_challenge_type IS NULL THEN
    RAISE EXCEPTION 'Défi non trouvé: %', p_challenge_id;
  END IF;

  RETURN QUERY
  WITH challenge_participants AS (
    SELECT cp.user_id
    FROM challenge_participants cp
    WHERE cp.challenge_id = p_challenge_id
  ),
  valid_rides AS (
    SELECT 
      r.user_id,
      r.distance,
      r.max_speed,
      r.duration,
      r.start_time
    FROM rides r
    INNER JOIN challenge_participants cp ON r.user_id = cp.user_id
    WHERE 
      -- Filtre par période du défi
      (v_start_date IS NULL OR r.start_time >= v_start_date)
      AND (v_end_date IS NULL OR r.start_time <= v_end_date)
      -- Conditions de validation fixes
      AND r.duration >= v_min_duration
      AND r.distance >= v_min_distance
  ),
  user_stats AS (
    SELECT 
      vr.user_id,
      COALESCE(SUM(vr.distance), 0)::NUMERIC as total_distance,
      COUNT(*)::INTEGER as total_rides,
      COALESCE(MAX(vr.max_speed), 0)::NUMERIC as max_speed,
      COALESCE(SUM(vr.duration), 0)::NUMERIC as total_duration
    FROM valid_rides vr
    GROUP BY vr.user_id
  ),
  ranked_stats AS (
    SELECT 
      us.user_id,
      us.total_distance,
      us.total_rides,
      us.max_speed,
      us.total_duration,
      CASE 
        WHEN v_challenge_type = 'distance' THEN
          DENSE_RANK() OVER (ORDER BY us.total_distance DESC)::INTEGER
        WHEN v_challenge_type = 'speed' THEN
          DENSE_RANK() OVER (ORDER BY us.max_speed DESC)::INTEGER
        WHEN v_challenge_type = 'count' THEN
          DENSE_RANK() OVER (ORDER BY us.total_rides DESC)::INTEGER
        ELSE
          0
      END::INTEGER as rank
    FROM user_stats us
  )
  SELECT 
    rs.user_id,
    rs.total_distance,
    rs.total_rides,
    rs.max_speed,
    rs.total_duration,
    rs.rank
  FROM ranked_stats rs
  ORDER BY rs.rank, rs.user_id;
END;
$$ LANGUAGE plpgsql;

-- Mise à jour de update_challenge_rankings (sans paramètre)
CREATE OR REPLACE FUNCTION update_challenge_rankings(
  p_challenge_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Supprimer les anciens classements
  DELETE FROM challenge_rankings
  WHERE challenge_id = p_challenge_id;

  -- Insérer les nouveaux classements
  INSERT INTO challenge_rankings (
    challenge_id,
    user_id,
    total_distance,
    total_rides,
    max_speed,
    total_duration,
    rank,
    last_updated
  )
  SELECT 
    p_challenge_id,
    ranking_data.user_id,
    ranking_data.total_distance,
    ranking_data.total_rides,
    ranking_data.max_speed,
    ranking_data.total_duration,
    ranking_data.rank,
    NOW()
  FROM calculate_challenge_rankings(p_challenge_id) AS ranking_data;
END;
$$ LANGUAGE plpgsql;

