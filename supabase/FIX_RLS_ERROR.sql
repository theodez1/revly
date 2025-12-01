-- ============================================
-- FIX: ERREUR RLS (Row Level Security)
-- ============================================
-- L'erreur "new row violates row-level security policy" survient car
-- le trigger essaie de modifier la table challenge_rankings (données globales)
-- avec les permissions de l'utilisateur courant (restreintes).
--
-- SOLUTION : Passer les fonctions en "SECURITY DEFINER" pour qu'elles
-- s'exécutent avec les privilèges de l'administrateur (postgres).
-- ============================================

-- 1. Fonction de mise à jour des classements (doit pouvoir supprimer/insérer pour tous les utilisateurs)
ALTER FUNCTION update_challenge_rankings(uuid, integer) SECURITY DEFINER;

-- 2. Fonction du trigger principal (doit pouvoir orchestrer le tout)
ALTER FUNCTION unified_handle_ride_change() SECURITY DEFINER;

-- 3. Fonction de calcul (optionnel mais recommandé pour la cohérence)
ALTER FUNCTION calculate_user_challenge_progress(uuid, uuid) SECURITY DEFINER;

-- 4. S'assurer que les tables sont accessibles
GRANT ALL ON challenge_rankings TO authenticated;
GRANT ALL ON challenge_participants TO authenticated;

SELECT '✅ Permissions corrigées (SECURITY DEFINER appliqué)' as status;
