-- ============================================
-- ACTIVATION DU TRIGGER POUR CLASSEMENTS AUTOMATIQUES
-- ============================================
-- Ce script active le trigger qui met à jour automatiquement
-- les classements des défis à chaque fois qu'un trajet est créé ou modifié
-- ============================================

-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
-- Se déclenche uniquement si distance, vitesse ou durée changent
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger pour DELETE (suppression de trajet)
-- Pour recalculer les classements si un trajet est supprimé
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_delete
  AFTER DELETE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- ============================================
-- CALCULER LES CLASSEMENTS INITIAUX
-- ============================================
-- Pour tous les défis actifs, calculer les classements maintenant
-- ============================================

DO $$
DECLARE
  challenge_record RECORD;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id);
    RAISE NOTICE 'Classements calculés pour le défi: %', challenge_record.id;
  END LOOP;
END $$;

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Vérifier que les triggers sont bien créés
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;


-- ============================================
-- Ce script active le trigger qui met à jour automatiquement
-- les classements des défis à chaque fois qu'un trajet est créé ou modifié
-- ============================================

-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
-- Se déclenche uniquement si distance, vitesse ou durée changent
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger pour DELETE (suppression de trajet)
-- Pour recalculer les classements si un trajet est supprimé
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_delete
  AFTER DELETE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- ============================================
-- CALCULER LES CLASSEMENTS INITIAUX
-- ============================================
-- Pour tous les défis actifs, calculer les classements maintenant
-- ============================================

DO $$
DECLARE
  challenge_record RECORD;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id);
    RAISE NOTICE 'Classements calculés pour le défi: %', challenge_record.id;
  END LOOP;
END $$;

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Vérifier que les triggers sont bien créés
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;


-- ============================================
-- Ce script active le trigger qui met à jour automatiquement
-- les classements des défis à chaque fois qu'un trajet est créé ou modifié
-- ============================================

-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
-- Se déclenche uniquement si distance, vitesse ou durée changent
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger pour DELETE (suppression de trajet)
-- Pour recalculer les classements si un trajet est supprimé
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_delete
  AFTER DELETE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- ============================================
-- CALCULER LES CLASSEMENTS INITIAUX
-- ============================================
-- Pour tous les défis actifs, calculer les classements maintenant
-- ============================================

DO $$
DECLARE
  challenge_record RECORD;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id);
    RAISE NOTICE 'Classements calculés pour le défi: %', challenge_record.id;
  END LOOP;
END $$;

-- ============================================
-- VÉRIFICATION
-- ============================================
-- Vérifier que les triggers sont bien créés
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;

