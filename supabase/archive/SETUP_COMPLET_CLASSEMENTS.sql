-- ============================================
-- SETUP COMPLET DU SYSTÈME DE CLASSEMENTS
-- ============================================
-- ⚠️ IMPORTANT : Exécuter d'abord challenge_rankings.sql
-- ============================================
-- Ce script active les triggers et calcule les classements initiaux
-- Il suppose que challenge_rankings.sql a déjà été exécuté
-- ============================================

-- Vérifier que la table existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_rankings') THEN
    RAISE EXCEPTION '❌ Table challenge_rankings manquante. Exécutez d''abord: supabase/challenge_rankings.sql';
  END IF;
END $$;

-- ============================================
-- ÉTAPE 2 : Activer les triggers
-- ============================================

-- Activer le trigger pour INSERT (création de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_insert ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_insert
  AFTER INSERT ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Activer le trigger pour UPDATE (modification de trajet)
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_update ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_update
  AFTER UPDATE ON rides
  FOR EACH ROW
  WHEN (OLD.distance IS DISTINCT FROM NEW.distance OR 
        OLD.max_speed IS DISTINCT FROM NEW.max_speed OR
        OLD.duration IS DISTINCT FROM NEW.duration)
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- Optionnel : Trigger pour DELETE
DROP TRIGGER IF EXISTS update_challenge_rankings_on_ride_delete ON rides;
CREATE TRIGGER update_challenge_rankings_on_ride_delete
  AFTER DELETE ON rides
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rankings_on_ride_for_challenges();

-- ============================================
-- ÉTAPE 3 : Calculer les classements initiaux
-- ============================================

DO $$
DECLARE
  challenge_record RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges 
    WHERE (end_date IS NULL OR end_date >= NOW())
      AND (start_date IS NULL OR start_date <= NOW())
  LOOP
    PERFORM update_challenge_rankings(challenge_record.id);
    v_count := v_count + 1;
  END LOOP;
END $$;

-- ============================================
-- VÉRIFICATION FINALE
-- ============================================

SELECT '✅ SETUP TERMINÉ' as status;

-- Vérifier les triggers
SELECT 
  trigger_name,
  event_manipulation as event,
  '✅ ACTIVÉ' as status
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;

