-- ============================================================================
-- INSTALLATION DU TRIGGER POUR LES STATS DES GROUPES
-- ============================================================================
-- Ce fichier installe les triggers qui mettent à jour automatiquement
-- les statistiques des groupes (total_distance, total_rides) lorsque:
-- - Un trajet est créé, mis à jour ou supprimé
-- - Un utilisateur rejoint/quitte un groupe
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Copier tout le contenu de ce fichier dans l'éditeur SQL de Supabase
-- 2. Exécuter le fichier
-- 3. Les stats seront automatiquement mises à jour pour tous les nouveaux trajets
-- 4. (Recommandé) Exécuter recalculate_all_group_stats() pour corriger les stats existantes
-- ============================================================================

-- IMPORTANT: Exécuter d'abord update_group_stats_trigger.sql
-- Puis exécuter les commandes ci-dessous pour vérifier et recalculer

-- Vérifier que les triggers sont bien installés
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE 'update_group_stats%'
ORDER BY trigger_name;

-- (RECOMMANDÉ) Recalculer les stats de tous les groupes existants
-- pour corriger les données qui ont été créées avant l'installation du trigger
SELECT recalculate_all_group_stats();

-- Vérification : Afficher les stats après recalcul
SELECT 
  id,
  name,
  total_distance,
  total_rides,
  updated_at
FROM groups
ORDER BY updated_at DESC
LIMIT 10;

