-- ============================================
-- TRIGGER UNIFIÉ POUR LES DÉFIS (PROGRESSION + CLASSEMENTS)
-- ============================================
-- Ce script remplace tous les anciens triggers liés aux défis.
-- Il gère :
-- 1. La mise à jour de la progression individuelle (challenge_participants)
-- 2. La mise à jour du classement général (challenge_rankings)
-- 3. L'ajout automatique des utilisateurs aux défis de leurs groupes
-- 4. Les cas INSERT, UPDATE et DELETE sur la table rides
-- ============================================

-- 1. Fonction utilitaire pour recalculer les stats d'un utilisateur pour un défi
-- Cette fonction assure que les données sont toujours cohérentes avec la table rides
DROP FUNCTION IF EXISTS calculate_user_challenge_progress(uuid, uuid);

CREATE OR REPLACE FUNCTION calculate_user_challenge_progress(
  p_user_id UUID,
  p_challenge_id UUID
)
RETURNS TABLE (
  calc_total_distance NUMERIC,
  calc_total_rides INTEGER,
  calc_max_speed NUMERIC
) AS $$
DECLARE
  v_start_date TIMESTAMP WITH TIME ZONE;
  v_end_date TIMESTAMP WITH TIME ZONE;
  v_group_id UUID;
  v_joined_at TIMESTAMP WITH TIME ZONE;
  v_effective_start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- 1. Récupérer les infos du défi
  SELECT start_date, end_date, group_id INTO v_start_date, v_end_date, v_group_id
  FROM challenges WHERE id = p_challenge_id;

  -- 2. Récupérer la date d'arrivée dans le groupe
  SELECT joined_at INTO v_joined_at
  FROM group_members 
  WHERE user_id = p_user_id AND group_id = v_group_id;

  -- 3. La date de début effective est la plus récente entre :
  --    - Le début du défi
  --    - L'arrivée du membre dans le groupe
  --    (Si v_joined_at est NULL, on prend v_start_date par sécurité, mais ça ne devrait pas arriver)
  v_effective_start_date := GREATEST(v_start_date, COALESCE(v_joined_at, v_start_date));

  RETURN QUERY
  SELECT 
    COALESCE(SUM(r.distance), 0)::NUMERIC,
    COUNT(*)::INTEGER,
    COALESCE(MAX(r.max_speed), 0)::NUMERIC
  FROM rides r
  WHERE r.user_id = p_user_id
    AND r.start_time >= v_effective_start_date
    AND (v_end_date IS NULL OR r.start_time <= v_end_date);
END;
$$ LANGUAGE plpgsql;

-- 2. Fonction principale du Trigger Unifié
CREATE OR REPLACE FUNCTION unified_handle_ride_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_ride_date TIMESTAMP WITH TIME ZONE;
  group_rec RECORD;
  challenge_rec RECORD;
  progress_rec RECORD;
BEGIN
  -- Déterminer l'utilisateur et la date (Gérer le cas DELETE)
  IF (TG_OP = 'DELETE') THEN
    v_user_id := OLD.user_id;
    v_ride_date := OLD.start_time;
  ELSE
    v_user_id := NEW.user_id;
    v_ride_date := NEW.start_time;
  END IF;

  -- Parcourir les groupes de l'utilisateur pour trouver les défis pertinents
  -- (On passe par les groupes pour gérer l'auto-join si nécessaire)
  FOR group_rec IN SELECT group_id FROM group_members WHERE user_id = v_user_id LOOP
    
    FOR challenge_rec IN 
      SELECT * FROM challenges 
      WHERE group_id = group_rec.group_id 
      AND start_date <= v_ride_date 
      AND (end_date IS NULL OR end_date >= v_ride_date) 
    LOOP
      
      -- A. Recalculer les stats pour cet utilisateur et ce défi
      -- On recalcule tout depuis la table rides pour garantir la cohérence (même en cas de suppression/modif)
      SELECT * INTO progress_rec FROM calculate_user_challenge_progress(v_user_id, challenge_rec.id);
      
      -- B. Mettre à jour ou Insérer dans challenge_participants
      -- UPSERT : Ajoute le participant s'il n'existe pas, ou met à jour ses stats
      INSERT INTO challenge_participants (challenge_id, user_id, progress, best_speed, updated_at)
      VALUES (
        challenge_rec.id, 
        v_user_id, 
        CASE 
          WHEN challenge_rec.type = 'distance' THEN progress_rec.calc_total_distance
          WHEN challenge_rec.type = 'count' THEN progress_rec.calc_total_rides
          ELSE 0 
        END,
        progress_rec.calc_max_speed,
        NOW()
      )
      ON CONFLICT (challenge_id, user_id) 
      DO UPDATE SET 
        progress = EXCLUDED.progress,
        best_speed = EXCLUDED.best_speed,
        updated_at = NOW();

      -- C. Mettre à jour les Classements (Leaderboard)
      -- On appelle la fonction existante qui met à jour challenge_rankings pour tout le défi
      -- (Assurez-vous que la fonction update_challenge_rankings existe, sinon le script précédent doit être exécuté)
      PERFORM update_challenge_rankings(challenge_rec.id);
      
    END LOOP;
  END LOOP;
  
  RETURN NULL; -- Le résultat est ignoré pour les triggers AFTER
END;
$$ LANGUAGE plpgsql;

-- 3. Création du Trigger
DROP TRIGGER IF EXISTS trigger_unified_challenge_updates ON rides;
CREATE TRIGGER trigger_unified_challenge_updates
AFTER INSERT OR UPDATE OR DELETE ON rides
FOR EACH ROW
EXECUTE FUNCTION unified_handle_ride_change();

-- 4. Nettoyage des anciens triggers (pour éviter les doublons)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
DROP TRIGGER IF EXISTS trigger_update_challenge_progress ON rides;

-- Confirmation
SELECT 'Trigger unifié installé avec succès. Anciens triggers supprimés.' as status;
