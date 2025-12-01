-- Fonction pour mettre à jour automatiquement les défis lors de l'ajout d'un trajet
CREATE OR REPLACE FUNCTION update_challenge_progress_on_ride()
RETURNS TRIGGER AS $$
DECLARE
  group_rec RECORD;
  challenge_rec RECORD;
BEGIN
  -- 1. Parcourir tous les groupes dont l'utilisateur est membre
  FOR group_rec IN SELECT group_id FROM group_members WHERE user_id = NEW.user_id LOOP
    
    -- 2. Parcourir tous les défis ACTIFS de ce groupe
    -- Le défi doit avoir commencé (start_date <= ride.start_time)
    -- Et ne pas être fini (end_date IS NULL ou end_date >= ride.start_time)
    FOR challenge_rec IN 
      SELECT * FROM challenges 
      WHERE group_id = group_rec.group_id 
      AND start_date <= NEW.start_time 
      AND (end_date IS NULL OR end_date >= NEW.start_time) 
    LOOP
      
      -- 3. Mise à jour selon le type de défi
      IF challenge_rec.type = 'distance' THEN
        -- Type DISTANCE : On cumule la distance (en mètres)
        INSERT INTO challenge_participants (challenge_id, user_id, progress, updated_at)
        VALUES (challenge_rec.id, NEW.user_id, COALESCE(NEW.distance, 0), NOW())
        ON CONFLICT (challenge_id, user_id) 
        DO UPDATE SET 
          progress = challenge_participants.progress + EXCLUDED.progress, 
          updated_at = NOW();
        
      ELSIF challenge_rec.type = 'count' THEN
        -- Type COUNT : On incrémente de 1 (nombre de trajets)
        INSERT INTO challenge_participants (challenge_id, user_id, progress, updated_at)
        VALUES (challenge_rec.id, NEW.user_id, 1, NOW())
        ON CONFLICT (challenge_id, user_id) 
        DO UPDATE SET 
          progress = challenge_participants.progress + 1, 
          updated_at = NOW();
        
      ELSIF challenge_rec.type = 'speed' THEN
        -- Type SPEED : On garde la MEILLEURE vitesse max
        INSERT INTO challenge_participants (challenge_id, user_id, best_speed, updated_at)
        VALUES (challenge_rec.id, NEW.user_id, COALESCE(NEW.max_speed, 0), NOW())
        ON CONFLICT (challenge_id, user_id) 
        DO UPDATE SET 
          best_speed = GREATEST(COALESCE(challenge_participants.best_speed, 0), EXCLUDED.best_speed),
          updated_at = NOW();
      END IF;
      
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Création du Trigger
DROP TRIGGER IF EXISTS trigger_update_challenge_progress ON rides;
CREATE TRIGGER trigger_update_challenge_progress
AFTER INSERT ON rides
FOR EACH ROW
EXECUTE FUNCTION update_challenge_progress_on_ride();
