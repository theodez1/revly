-- ============================================
-- SYSTÈME DE CLASSEMENTS PAR DÉFI
-- ============================================
-- Classements en temps réel basés sur les trajets pour chaque défi :
-- 1. Plus de km (distance totale) - pour défis de type 'distance'
-- 2. Plus haute vitesse (vitesse maximale) - pour défis de type 'speed'
-- 3. Plus de trajets (nombre de trajets valides) - pour défis de type 'count'
-- ============================================

-- Table pour stocker les classements par défi (cache pour performance)
CREATE TABLE IF NOT EXISTS challenge_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stats calculées selon le type de défi
  total_distance NUMERIC DEFAULT 0,        -- Distance totale en mètres (pour type 'distance')
  total_rides INTEGER DEFAULT 0,           -- Nombre de trajets valides (pour type 'count')
  max_speed NUMERIC DEFAULT 0,             -- Vitesse maximale en km/h (pour type 'speed')
  total_duration NUMERIC DEFAULT 0,        -- Durée totale en secondes
  
  -- Rang (calculé lors de la mise à jour selon le type de défi)
  rank INTEGER DEFAULT 0,                   -- Rang pour le type de défi
  
  -- Métadonnées
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_challenge_id ON challenge_rankings(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_user_id ON challenge_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_rank ON challenge_rankings(challenge_id, rank);

-- Fonction pour calculer les classements d'un défi
CREATE OR REPLACE FUNCTION calculate_challenge_rankings(
  p_challenge_id UUID,
  p_min_ride_duration_seconds INTEGER DEFAULT 300  -- 5 minutes par défaut
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
      -- Durée minimale du trajet
      AND r.duration >= p_min_ride_duration_seconds
      -- Distance minimale (optionnel, 100m)
      AND r.distance >= 100
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
  ORDER BY rs.rank;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les classements d'un défi
CREATE OR REPLACE FUNCTION update_challenge_rankings(
  p_challenge_id UUID,
  p_min_ride_duration_seconds INTEGER DEFAULT 300
)
RETURNS void AS $$
BEGIN
  -- Supprimer les anciens classements
  DELETE FROM challenge_rankings
  WHERE challenge_id = p_challenge_id;

  -- Insérer les nouveaux classements avec les rangs
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
  FROM calculate_challenge_rankings(
    p_challenge_id,
    p_min_ride_duration_seconds
  ) AS ranking_data;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement les classements quand un trajet est créé
CREATE OR REPLACE FUNCTION trigger_update_rankings_on_ride_for_challenges()
RETURNS TRIGGER AS $$
DECLARE
  v_challenge_ids UUID[];
  v_challenge_id UUID;
  v_challenge_record RECORD;
BEGIN
  -- Récupérer tous les défis actifs où l'utilisateur est participant
  SELECT ARRAY_AGG(cp.challenge_id)
  INTO v_challenge_ids
  FROM challenge_participants cp
  INNER JOIN challenges c ON cp.challenge_id = c.id
  WHERE cp.user_id = NEW.user_id
    AND (c.end_date IS NULL OR c.end_date >= NOW())
    AND (c.start_date IS NULL OR c.start_date <= NOW());

  -- Mettre à jour les classements pour chaque défi actif
  IF v_challenge_ids IS NOT NULL AND array_length(v_challenge_ids, 1) > 0 THEN
    FOREACH v_challenge_id IN ARRAY v_challenge_ids
    LOOP
      -- Vérifier que le trajet est dans la période du défi
      SELECT start_date, end_date
      INTO v_challenge_record
      FROM challenges
      WHERE id = v_challenge_id;

      IF v_challenge_record.start_date IS NULL OR NEW.start_time >= v_challenge_record.start_date THEN
        IF v_challenge_record.end_date IS NULL OR NEW.start_time <= v_challenge_record.end_date THEN
          PERFORM update_challenge_rankings(v_challenge_id);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (si la table rides existe)
-- IMPORTANT: Décommenter ces lignes après avoir vérifié que la table rides existe
-- DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
-- CREATE TRIGGER update_challenge_rankings_on_ride_insert
--   AFTER INSERT ON rides
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Alternative: Trigger aussi sur UPDATE (si un trajet est modifié)
-- DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
-- CREATE TRIGGER update_challenge_rankings_on_ride_update
--   AFTER UPDATE ON rides
--   FOR EACH ROW
--   WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
--         OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
--         OLD.duration IS DISTINCT FROM NEW.duration)
--   EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- RLS pour challenge_rankings
ALTER TABLE challenge_rankings ENABLE ROW LEVEL SECURITY;

-- Les participants d'un défi peuvent voir les classements de leur défi
DROP POLICY IF EXISTS "Participants peuvent voir les classements de leur défi" ON challenge_rankings;
CREATE POLICY "Participants peuvent voir les classements de leur défi" ON challenge_rankings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants cp
      INNER JOIN challenges c ON cp.challenge_id = c.id
      WHERE cp.challenge_id = challenge_rankings.challenge_id
        AND cp.user_id = auth.uid()
    )
  );

-- ============================================
-- VUE POUR FACILITER LES REQUÊTES
-- ============================================

-- Vue pour les classements de défi
CREATE OR REPLACE VIEW challenge_rankings_view AS
SELECT 
  cr.challenge_id,
  cr.user_id,
  cr.total_distance,
  cr.total_rides,
  cr.max_speed,
  cr.total_duration,
  cr.rank,
  c.type as challenge_type,
  c.title as challenge_title,
  u.username,
  u.first_name,
  u.last_name,
  u.avatar_url
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
LEFT JOIN users u ON cr.user_id = u.id
ORDER BY cr.challenge_id, cr.rank;


-- ============================================
-- Classements en temps réel basés sur les trajets pour chaque défi :
-- 1. Plus de km (distance totale) - pour défis de type 'distance'
-- 2. Plus haute vitesse (vitesse maximale) - pour défis de type 'speed'
-- 3. Plus de trajets (nombre de trajets valides) - pour défis de type 'count'
-- ============================================

-- Table pour stocker les classements par défi (cache pour performance)
CREATE TABLE IF NOT EXISTS challenge_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stats calculées selon le type de défi
  total_distance NUMERIC DEFAULT 0,        -- Distance totale en mètres (pour type 'distance')
  total_rides INTEGER DEFAULT 0,           -- Nombre de trajets valides (pour type 'count')
  max_speed NUMERIC DEFAULT 0,             -- Vitesse maximale en km/h (pour type 'speed')
  total_duration NUMERIC DEFAULT 0,        -- Durée totale en secondes
  
  -- Rang (calculé lors de la mise à jour selon le type de défi)
  rank INTEGER DEFAULT 0,                   -- Rang pour le type de défi
  
  -- Métadonnées
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_challenge_id ON challenge_rankings(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_user_id ON challenge_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_rank ON challenge_rankings(challenge_id, rank);

-- Fonction pour calculer les classements d'un défi
CREATE OR REPLACE FUNCTION calculate_challenge_rankings(
  p_challenge_id UUID,
  p_min_ride_duration_seconds INTEGER DEFAULT 300  -- 5 minutes par défaut
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
      -- Durée minimale du trajet
      AND r.duration >= p_min_ride_duration_seconds
      -- Distance minimale (optionnel, 100m)
      AND r.distance >= 100
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
  ORDER BY rs.rank;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les classements d'un défi
CREATE OR REPLACE FUNCTION update_challenge_rankings(
  p_challenge_id UUID,
  p_min_ride_duration_seconds INTEGER DEFAULT 300
)
RETURNS void AS $$
BEGIN
  -- Supprimer les anciens classements
  DELETE FROM challenge_rankings
  WHERE challenge_id = p_challenge_id;

  -- Insérer les nouveaux classements avec les rangs
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
  FROM calculate_challenge_rankings(
    p_challenge_id,
    p_min_ride_duration_seconds
  ) AS ranking_data;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement les classements quand un trajet est créé
CREATE OR REPLACE FUNCTION trigger_update_rankings_on_ride_for_challenges()
RETURNS TRIGGER AS $$
DECLARE
  v_challenge_ids UUID[];
  v_challenge_id UUID;
  v_challenge_record RECORD;
BEGIN
  -- Récupérer tous les défis actifs où l'utilisateur est participant
  SELECT ARRAY_AGG(cp.challenge_id)
  INTO v_challenge_ids
  FROM challenge_participants cp
  INNER JOIN challenges c ON cp.challenge_id = c.id
  WHERE cp.user_id = NEW.user_id
    AND (c.end_date IS NULL OR c.end_date >= NOW())
    AND (c.start_date IS NULL OR c.start_date <= NOW());

  -- Mettre à jour les classements pour chaque défi actif
  IF v_challenge_ids IS NOT NULL AND array_length(v_challenge_ids, 1) > 0 THEN
    FOREACH v_challenge_id IN ARRAY v_challenge_ids
    LOOP
      -- Vérifier que le trajet est dans la période du défi
      SELECT start_date, end_date
      INTO v_challenge_record
      FROM challenges
      WHERE id = v_challenge_id;

      IF v_challenge_record.start_date IS NULL OR NEW.start_time >= v_challenge_record.start_date THEN
        IF v_challenge_record.end_date IS NULL OR NEW.start_time <= v_challenge_record.end_date THEN
          PERFORM update_challenge_rankings(v_challenge_id);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (si la table rides existe)
-- IMPORTANT: Décommenter ces lignes après avoir vérifié que la table rides existe
-- DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
-- CREATE TRIGGER update_challenge_rankings_on_ride_insert
--   AFTER INSERT ON rides
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Alternative: Trigger aussi sur UPDATE (si un trajet est modifié)
-- DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
-- CREATE TRIGGER update_challenge_rankings_on_ride_update
--   AFTER UPDATE ON rides
--   FOR EACH ROW
--   WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
--         OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
--         OLD.duration IS DISTINCT FROM NEW.duration)
--   EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- RLS pour challenge_rankings
ALTER TABLE challenge_rankings ENABLE ROW LEVEL SECURITY;

-- Les participants d'un défi peuvent voir les classements de leur défi
DROP POLICY IF EXISTS "Participants peuvent voir les classements de leur défi" ON challenge_rankings;
CREATE POLICY "Participants peuvent voir les classements de leur défi" ON challenge_rankings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants cp
      INNER JOIN challenges c ON cp.challenge_id = c.id
      WHERE cp.challenge_id = challenge_rankings.challenge_id
        AND cp.user_id = auth.uid()
    )
  );

-- ============================================
-- VUE POUR FACILITER LES REQUÊTES
-- ============================================

-- Vue pour les classements de défi
CREATE OR REPLACE VIEW challenge_rankings_view AS
SELECT 
  cr.challenge_id,
  cr.user_id,
  cr.total_distance,
  cr.total_rides,
  cr.max_speed,
  cr.total_duration,
  cr.rank,
  c.type as challenge_type,
  c.title as challenge_title,
  u.username,
  u.first_name,
  u.last_name,
  u.avatar_url
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
LEFT JOIN users u ON cr.user_id = u.id
ORDER BY cr.challenge_id, cr.rank;


-- ============================================
-- Classements en temps réel basés sur les trajets pour chaque défi :
-- 1. Plus de km (distance totale) - pour défis de type 'distance'
-- 2. Plus haute vitesse (vitesse maximale) - pour défis de type 'speed'
-- 3. Plus de trajets (nombre de trajets valides) - pour défis de type 'count'
-- ============================================

-- Table pour stocker les classements par défi (cache pour performance)
CREATE TABLE IF NOT EXISTS challenge_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Stats calculées selon le type de défi
  total_distance NUMERIC DEFAULT 0,        -- Distance totale en mètres (pour type 'distance')
  total_rides INTEGER DEFAULT 0,           -- Nombre de trajets valides (pour type 'count')
  max_speed NUMERIC DEFAULT 0,             -- Vitesse maximale en km/h (pour type 'speed')
  total_duration NUMERIC DEFAULT 0,        -- Durée totale en secondes
  
  -- Rang (calculé lors de la mise à jour selon le type de défi)
  rank INTEGER DEFAULT 0,                   -- Rang pour le type de défi
  
  -- Métadonnées
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_challenge_id ON challenge_rankings(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_user_id ON challenge_rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_rankings_rank ON challenge_rankings(challenge_id, rank);

-- Fonction pour calculer les classements d'un défi
CREATE OR REPLACE FUNCTION calculate_challenge_rankings(
  p_challenge_id UUID,
  p_min_ride_duration_seconds INTEGER DEFAULT 300  -- 5 minutes par défaut
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
      -- Durée minimale du trajet
      AND r.duration >= p_min_ride_duration_seconds
      -- Distance minimale (optionnel, 100m)
      AND r.distance >= 100
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
  ORDER BY rs.rank;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les classements d'un défi
CREATE OR REPLACE FUNCTION update_challenge_rankings(
  p_challenge_id UUID,
  p_min_ride_duration_seconds INTEGER DEFAULT 300
)
RETURNS void AS $$
BEGIN
  -- Supprimer les anciens classements
  DELETE FROM challenge_rankings
  WHERE challenge_id = p_challenge_id;

  -- Insérer les nouveaux classements avec les rangs
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
  FROM calculate_challenge_rankings(
    p_challenge_id,
    p_min_ride_duration_seconds
  ) AS ranking_data;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement les classements quand un trajet est créé
CREATE OR REPLACE FUNCTION trigger_update_rankings_on_ride_for_challenges()
RETURNS TRIGGER AS $$
DECLARE
  v_challenge_ids UUID[];
  v_challenge_id UUID;
  v_challenge_record RECORD;
BEGIN
  -- Récupérer tous les défis actifs où l'utilisateur est participant
  SELECT ARRAY_AGG(cp.challenge_id)
  INTO v_challenge_ids
  FROM challenge_participants cp
  INNER JOIN challenges c ON cp.challenge_id = c.id
  WHERE cp.user_id = NEW.user_id
    AND (c.end_date IS NULL OR c.end_date >= NOW())
    AND (c.start_date IS NULL OR c.start_date <= NOW());

  -- Mettre à jour les classements pour chaque défi actif
  IF v_challenge_ids IS NOT NULL AND array_length(v_challenge_ids, 1) > 0 THEN
    FOREACH v_challenge_id IN ARRAY v_challenge_ids
    LOOP
      -- Vérifier que le trajet est dans la période du défi
      SELECT start_date, end_date
      INTO v_challenge_record
      FROM challenges
      WHERE id = v_challenge_id;

      IF v_challenge_record.start_date IS NULL OR NEW.start_time >= v_challenge_record.start_date THEN
        IF v_challenge_record.end_date IS NULL OR NEW.start_time <= v_challenge_record.end_date THEN
          PERFORM update_challenge_rankings(v_challenge_id);
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (si la table rides existe)
-- IMPORTANT: Décommenter ces lignes après avoir vérifié que la table rides existe
-- DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
-- CREATE TRIGGER update_challenge_rankings_on_ride_insert
--   AFTER INSERT ON rides
--   FOR EACH ROW
--   EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Alternative: Trigger aussi sur UPDATE (si un trajet est modifié)
-- DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
-- CREATE TRIGGER update_challenge_rankings_on_ride_update
--   AFTER UPDATE ON rides
--   FOR EACH ROW
--   WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
--         OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
--         OLD.duration IS DISTINCT FROM NEW.duration)
--   EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- RLS pour challenge_rankings
ALTER TABLE challenge_rankings ENABLE ROW LEVEL SECURITY;

-- Les participants d'un défi peuvent voir les classements de leur défi
DROP POLICY IF EXISTS "Participants peuvent voir les classements de leur défi" ON challenge_rankings;
CREATE POLICY "Participants peuvent voir les classements de leur défi" ON challenge_rankings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM challenge_participants cp
      INNER JOIN challenges c ON cp.challenge_id = c.id
      WHERE cp.challenge_id = challenge_rankings.challenge_id
        AND cp.user_id = auth.uid()
    )
  );

-- ============================================
-- VUE POUR FACILITER LES REQUÊTES
-- ============================================

-- Vue pour les classements de défi
CREATE OR REPLACE VIEW challenge_rankings_view AS
SELECT 
  cr.challenge_id,
  cr.user_id,
  cr.total_distance,
  cr.total_rides,
  cr.max_speed,
  cr.total_duration,
  cr.rank,
  c.type as challenge_type,
  c.title as challenge_title,
  u.username,
  u.first_name,
  u.last_name,
  u.avatar_url
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
LEFT JOIN users u ON cr.user_id = u.id
ORDER BY cr.challenge_id, cr.rank;

