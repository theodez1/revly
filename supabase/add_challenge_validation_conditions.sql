-- ============================================
-- AJOUT DES CONDITIONS DE VALIDATION PAR DÉFI
-- ============================================
-- Permet de définir pour chaque défi :
-- - Distance minimale d'un trajet (en mètres)
-- - Durée minimale d'un trajet (en secondes)
-- ============================================

-- Ajouter les colonnes de validation à la table challenges
ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS min_distance_meters NUMERIC DEFAULT 1000,  -- Distance minimale en mètres (défaut: 1000m = 1km)
ADD COLUMN IF NOT EXISTS min_duration_seconds INTEGER DEFAULT 300; -- Durée minimale en secondes (défaut: 300s = 5min)

-- Commentaires pour documentation
COMMENT ON COLUMN challenges.min_distance_meters IS 'Distance minimale en mètres qu''un trajet doit parcourir pour être comptabilisé dans ce défi';
COMMENT ON COLUMN challenges.min_duration_seconds IS 'Durée minimale en secondes qu''un trajet doit durer pour être comptabilisé dans ce défi';

-- Index pour améliorer les performances si besoin
CREATE INDEX IF NOT EXISTS idx_challenges_validation ON challenges(min_distance_meters, min_duration_seconds);

-- ============================================
-- MISE À JOUR DE LA FONCTION DE CALCUL
-- ============================================
-- Modifier calculate_challenge_rankings pour utiliser les conditions du défi

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
  v_min_distance NUMERIC;
  v_min_duration INTEGER;
BEGIN
  -- Récupérer les infos du défi (y compris les conditions de validation)
  SELECT type, start_date, end_date, min_distance_meters, min_duration_seconds
  INTO v_challenge_type, v_start_date, v_end_date, v_min_distance, v_min_duration
  FROM challenges
  WHERE id = p_challenge_id;

  IF v_challenge_type IS NULL THEN
    RAISE EXCEPTION 'Défi non trouvé: %', p_challenge_id;
  END IF;

  -- Valeurs par défaut si non définies
  IF v_min_distance IS NULL THEN
    v_min_distance := 1000; -- 1 km par défaut
  END IF;
  IF v_min_duration IS NULL THEN
    v_min_duration := 300; -- 5 minutes par défaut
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
      -- Conditions de validation du défi
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

-- ============================================
-- MISE À JOUR DE LA FONCTION update_challenge_rankings
-- ============================================
-- Supprimer le paramètre p_min_ride_duration_seconds car maintenant lu depuis la table

CREATE OR REPLACE FUNCTION update_challenge_rankings(
  p_challenge_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Supprimer les anciens classements
  DELETE FROM challenge_rankings
  WHERE challenge_id = p_challenge_id;

  -- Insérer les nouveaux classements (sans paramètre de durée minimale)
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

-- ============================================
-- NOTE IMPORTANTE
-- ============================================
-- Après avoir exécuté ce script, vous devez aussi mettre à jour
-- le trigger trigger_update_rankings_on_ride_for_challenges()
-- pour qu'il appelle update_challenge_rankings sans paramètre.
-- 
-- Dans le trigger, remplacer :
--   PERFORM update_challenge_rankings(v_challenge_id, 300);
-- par :
--   PERFORM update_challenge_rankings(v_challenge_id);
--
-- Ceci est déjà fait dans les fichiers :
-- - challenge_rankings.sql
-- - INSTALLATION_COMPLETE_CLASSEMENTS.sql
-- - activate_challenge_rankings_trigger.sql
-- - SETUP_COMPLET_CLASSEMENTS.sql

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Afficher un résumé des défis avec leurs conditions

SELECT 
  id,
  title,
  type,
  min_distance_meters,
  min_duration_seconds,
  CASE 
    WHEN min_distance_meters >= 1000 THEN 
      ROUND(min_distance_meters / 1000, 1) || ' km'
    ELSE 
      min_distance_meters || ' m'
  END as min_distance_display,
  CASE 
    WHEN min_duration_seconds >= 60 THEN 
      ROUND(min_duration_seconds / 60, 1) || ' min'
    ELSE 
      min_duration_seconds || ' s'
  END as min_duration_display
FROM challenges
ORDER BY created_at DESC
LIMIT 10;

