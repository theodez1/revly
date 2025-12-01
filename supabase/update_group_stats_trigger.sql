-- Trigger pour mettre à jour automatiquement les statistiques des groupes
-- lorsque des trajets sont créés, mis à jour ou supprimés

-- Fonction pour recalculer les stats d'un groupe
CREATE OR REPLACE FUNCTION update_group_stats()
RETURNS TRIGGER AS $$
DECLARE
  ride_user_id UUID;
  ride_distance NUMERIC;
  ride_count INTEGER;
  group_record RECORD;
BEGIN
  -- Déterminer user_id et distance selon l'opération
  IF TG_OP = 'DELETE' THEN
    -- Trajet supprimé : on recalcule les stats en excluant ce trajet
    -- Le trajet n'existe plus dans la table rides, donc il ne sera pas compté dans le recalcul
    ride_user_id := OLD.user_id;
    ride_distance := COALESCE(OLD.distance, 0);
    ride_count := -1;
  ELSE
    ride_user_id := NEW.user_id;
    
    IF TG_OP = 'INSERT' THEN
      ride_distance := COALESCE(NEW.distance, 0);
      ride_count := 1;
    ELSE -- UPDATE
      ride_distance := COALESCE(NEW.distance, 0) - COALESCE(OLD.distance, 0);
      ride_count := 0; -- Le nombre de trajets ne change pas lors d'un UPDATE
    END IF;
  END IF;

  -- Mettre à jour les stats pour tous les groupes dont l'utilisateur est membre ACTIF
  -- IMPORTANT : On compte SEULEMENT les trajets des membres actifs
  -- IMPORTANT : Pour DELETE, on recalcule depuis zéro en excluant le trajet supprimé
  FOR group_record IN
    SELECT DISTINCT gm.group_id
    FROM group_members gm
    WHERE gm.user_id = ride_user_id
  LOOP
    -- Recalculer les stats du groupe depuis les trajets des membres ACTIFS uniquement
    -- NOTE : Pour DELETE, le trajet supprimé n'existe plus dans rides, donc il est automatiquement exclu
    UPDATE groups
    SET
      total_distance = (
        SELECT COALESCE(SUM(r.distance), 0)
        FROM rides r
        INNER JOIN group_members gm ON gm.user_id = r.user_id
        WHERE gm.group_id = group_record.group_id
          -- Compter SEULEMENT les trajets des membres ACTIFS
          AND gm.status = 'active'
          AND r.start_time >= gm.joined_at
      ),
      total_rides = (
        SELECT COUNT(*)
        FROM rides r
        INNER JOIN group_members gm ON gm.user_id = r.user_id
        WHERE gm.group_id = group_record.group_id
          -- Compter SEULEMENT les trajets des membres ACTIFS
          AND gm.status = 'active'
          AND r.start_time >= gm.joined_at
      ),
      updated_at = NOW()
    WHERE id = group_record.group_id;
  END LOOP;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Supprimer les triggers existants s'ils existent
DROP TRIGGER IF EXISTS update_group_stats_on_ride_insert ON rides;
DROP TRIGGER IF EXISTS update_group_stats_on_ride_update ON rides;
DROP TRIGGER IF EXISTS update_group_stats_on_ride_delete ON rides;

-- Créer les triggers
CREATE TRIGGER update_group_stats_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION update_group_stats();

CREATE TRIGGER update_group_stats_on_ride_update
  AFTER UPDATE OF distance ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance)
  EXECUTE FUNCTION update_group_stats();

CREATE TRIGGER update_group_stats_on_ride_delete
  AFTER DELETE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION update_group_stats();

-- Trigger pour mettre à jour les stats quand un utilisateur rejoint/quitte un groupe
CREATE OR REPLACE FUNCTION update_group_stats_on_membership_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_user_id UUID;
BEGIN
  -- Déterminer user_id selon l'opération
  IF TG_OP = 'DELETE' THEN
    affected_user_id := OLD.user_id;
  ELSE
    affected_user_id := NEW.user_id;
  END IF;

  -- Mettre à jour les stats du groupe concerné
  -- On compte SEULEMENT les trajets des membres ACTIFS
  IF TG_OP = 'DELETE' THEN
    UPDATE groups
    SET
      total_distance = (
        SELECT COALESCE(SUM(r.distance), 0)
        FROM rides r
        INNER JOIN group_members gm ON gm.user_id = r.user_id
        WHERE gm.group_id = OLD.group_id
          -- Compter SEULEMENT les trajets des membres ACTIFS
          AND gm.status = 'active'
          AND r.start_time >= gm.joined_at
      ),
      total_rides = (
        SELECT COUNT(*)
        FROM rides r
        INNER JOIN group_members gm ON gm.user_id = r.user_id
        WHERE gm.group_id = OLD.group_id
          -- Compter SEULEMENT les trajets des membres ACTIFS
          AND gm.status = 'active'
          AND r.start_time >= gm.joined_at
      ),
      updated_at = NOW()
    WHERE id = OLD.group_id;
  ELSE
    UPDATE groups
    SET
      total_distance = (
        SELECT COALESCE(SUM(r.distance), 0)
        FROM rides r
        INNER JOIN group_members gm ON gm.user_id = r.user_id
        WHERE gm.group_id = NEW.group_id
          -- Compter SEULEMENT les trajets des membres ACTIFS
          AND gm.status = 'active'
          AND r.start_time >= gm.joined_at
      ),
      total_rides = (
        SELECT COUNT(*)
        FROM rides r
        INNER JOIN group_members gm ON gm.user_id = r.user_id
        WHERE gm.group_id = NEW.group_id
          -- Compter SEULEMENT les trajets des membres ACTIFS
          AND gm.status = 'active'
          AND r.start_time >= gm.joined_at
      ),
      updated_at = NOW()
    WHERE id = NEW.group_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Supprimer les triggers existants s'ils existent
DROP TRIGGER IF EXISTS update_group_stats_on_member_insert ON group_members;
DROP TRIGGER IF EXISTS update_group_stats_on_member_update ON group_members;
DROP TRIGGER IF EXISTS update_group_stats_on_member_delete ON group_members;

-- Créer les triggers pour les changements de statut des membres
CREATE TRIGGER update_group_stats_on_member_insert
  AFTER INSERT ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_stats_on_membership_change();

CREATE TRIGGER update_group_stats_on_member_update
  AFTER UPDATE OF status ON group_members
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_group_stats_on_membership_change();

CREATE TRIGGER update_group_stats_on_member_delete
  AFTER DELETE ON group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_stats_on_membership_change();

-- Fonction pour recalculer les stats de tous les groupes (pour migration/correction)
-- Les stats incluent SEULEMENT les trajets des membres ACTIFS
CREATE OR REPLACE FUNCTION recalculate_all_group_stats()
RETURNS void AS $$
BEGIN
  UPDATE groups g
  SET
    total_distance = (
      SELECT COALESCE(SUM(r.distance), 0)
      FROM rides r
      INNER JOIN group_members gm ON gm.user_id = r.user_id
      WHERE gm.group_id = g.id
        -- Compter SEULEMENT les trajets des membres ACTIFS
        AND gm.status = 'active'
        AND r.start_time >= gm.joined_at
    ),
    total_rides = (
      SELECT COUNT(*)
      FROM rides r
      INNER JOIN group_members gm ON gm.user_id = r.user_id
      WHERE gm.group_id = g.id
        -- Compter SEULEMENT les trajets des membres ACTIFS
        AND gm.status = 'active'
        AND r.start_time >= gm.joined_at
    ),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Optionnel : Exécuter la recalcul immédiat pour corriger les données existantes
-- SELECT recalculate_all_group_stats();

