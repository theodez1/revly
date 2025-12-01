-- ============================================
-- NETTOYAGE : Suppression du système de classements par groupe
-- ============================================
-- À exécuter dans Supabase SQL Editor pour supprimer
-- tout ce qui a été créé avec group_rankings.sql
-- ============================================

-- 0. VÉRIFICATION : Lister les triggers existants (optionnel)
-- Décommentez pour voir quels triggers existent avant suppression :
-- SELECT trigger_name, event_object_table, action_statement 
-- FROM information_schema.triggers 
-- WHERE trigger_name LIKE '%rankings%' OR trigger_name LIKE '%rankings_on_ride%';

-- 1. Supprimer les triggers (si activés)
DROP TRIGGER IF EXISTS update_rankings_on_ride_insert ON rides;
DROP TRIGGER IF EXISTS update_rankings_on_ride_update ON rides;

-- 2. Supprimer les fonctions
DROP FUNCTION IF EXISTS trigger_update_rankings_on_ride();
DROP FUNCTION IF EXISTS update_group_rankings(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS calculate_group_rankings(UUID, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER);

-- 3. Supprimer les vues
DROP VIEW IF EXISTS group_rides_rankings;
DROP VIEW IF EXISTS group_speed_rankings;
DROP VIEW IF EXISTS group_distance_rankings;

-- 4. Supprimer les policies RLS
DROP POLICY IF EXISTS "Membres peuvent voir les classements de leur groupe" ON group_rankings;

-- 5. Supprimer la table (cela supprimera aussi toutes les données)
DROP TABLE IF EXISTS group_rankings;

-- ============================================
-- VÉRIFICATION (optionnel)
-- ============================================
-- Exécutez ces requêtes pour vérifier que tout a été supprimé :

-- Vérifier que la table n'existe plus
-- SELECT * FROM information_schema.tables WHERE table_name = 'group_rankings';
-- (Ne doit rien retourner)

-- Vérifier que les fonctions n'existent plus
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name LIKE '%group_rankings%' OR routine_name LIKE '%rankings_on_ride%';
-- (Ne doit rien retourner)

-- Vérifier que les triggers n'existent plus
-- SELECT trigger_name FROM information_schema.triggers 
-- WHERE trigger_name LIKE '%rankings%' OR trigger_name LIKE '%rankings_on_ride%';
-- (Ne doit rien retourner)

