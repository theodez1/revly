-- ============================================
-- VÉRIFICATION COMPLÈTE DU SYSTÈME DE CLASSEMENTS
-- ============================================
-- Ce script vérifie que tous les éléments nécessaires sont en place
-- ============================================

-- 1. Vérifier que la table challenge_rankings existe
SELECT 
  '✅ Table challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_rankings')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 2. Vérifier les colonnes de la table
SELECT 
  '✅ Colonnes de challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'challenge_rankings' 
      AND column_name IN ('id', 'challenge_id', 'user_id', 'total_distance', 'total_rides', 'max_speed', 'rank', 'last_updated')
    )
    THEN 'OK'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL

-- 3. Vérifier que la fonction calculate_challenge_rankings existe
SELECT 
  '✅ Fonction calculate_challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'calculate_challenge_rankings'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 4. Vérifier que la fonction update_challenge_rankings existe
SELECT 
  '✅ Fonction update_challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'update_challenge_rankings'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 5. Vérifier que la fonction trigger_update_rankings_on_ride_for_challenges existe
SELECT 
  '✅ Fonction trigger_update_rankings_on_ride_for_challenges' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'trigger_update_rankings_on_ride_for_challenges'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 6. Vérifier que le trigger INSERT est activé
SELECT 
  '✅ Trigger INSERT (création trajet)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_insert'
      AND event_object_table = 'rides'
    )
    THEN 'ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL

-- 7. Vérifier que le trigger UPDATE est activé
SELECT 
  '✅ Trigger UPDATE (modification trajet)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_update'
      AND event_object_table = 'rides'
    )
    THEN 'ACTIVÉ'
    ELSE '⚠️ NON ACTIVÉ (optionnel)'
  END as status
UNION ALL

-- 8. Vérifier que la vue challenge_rankings_view existe
SELECT 
  '✅ Vue challenge_rankings_view' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'challenge_rankings_view'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 9. Vérifier que RLS est activé sur challenge_rankings
SELECT 
  '✅ RLS activé sur challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'challenge_rankings' 
      AND rowsecurity = true
    )
    THEN 'ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL

-- 10. Vérifier que la policy RLS existe
SELECT 
  '✅ Policy RLS pour challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'challenge_rankings'
      AND policyname = 'Participants peuvent voir les classements de leur défi'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 11. Vérifier que la table rides existe (nécessaire pour les triggers)
SELECT 
  '✅ Table rides' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 12. Vérifier les colonnes nécessaires dans rides
SELECT 
  '✅ Colonnes de rides (user_id, distance, max_speed, duration, start_time)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rides' 
      AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time')
      HAVING COUNT(*) = 5
    )
    THEN 'OK'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL

-- 13. Vérifier que la table challenges existe
SELECT 
  '✅ Table challenges' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenges')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 14. Vérifier que la table challenge_participants existe
SELECT 
  '✅ Table challenge_participants' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_participants')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status;

-- ============================================
-- STATISTIQUES
-- ============================================

SELECT '--- STATISTIQUES ---' as info;

-- Nombre de classements enregistrés
SELECT 
  'Nombre de classements enregistrés' as stat_name,
  COUNT(*) as value
FROM challenge_rankings;

-- Nombre de défis avec des classements
SELECT 
  'Nombre de défis avec classements' as stat_name,
  COUNT(DISTINCT challenge_id) as value
FROM challenge_rankings;

-- Nombre d'utilisateurs classés
SELECT 
  'Nombre d''utilisateurs classés' as stat_name,
  COUNT(DISTINCT user_id) as value
FROM challenge_rankings;

-- Exemple de classement (premier défi trouvé)
SELECT 
  'Exemple de classement (premier défi)' as info,
  cr.challenge_id,
  c.title as challenge_title,
  c.type as challenge_type,
  COUNT(*) as nb_participants,
  MAX(cr.rank) as meilleur_rang
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
GROUP BY cr.challenge_id, c.title, c.type
LIMIT 1;

-- ============================================
-- LISTE DES TRIGGERS ACTIFS
-- ============================================

SELECT '--- TRIGGERS ACTIFS ---' as info;

SELECT 
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  action_timing as timing,
  action_statement as function
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;

-- ============================================
-- TEST DE CALCUL (si des défis existent)
-- ============================================

SELECT '--- TEST DE CALCUL ---' as info;

-- Tester le calcul pour le premier défi actif trouvé
DO $$
DECLARE
  v_test_challenge_id UUID;
  v_test_result RECORD;
BEGIN
  -- Trouver un défi actif
  SELECT id INTO v_test_challenge_id
  FROM challenges
  WHERE (end_date IS NULL OR end_date >= NOW())
    AND (start_date IS NULL OR start_date <= NOW())
  LIMIT 1;
  
  IF v_test_challenge_id IS NOT NULL THEN
    RAISE NOTICE 'Test de calcul pour le défi: %', v_test_challenge_id;
    
    -- Tester la fonction de calcul
    SELECT * INTO v_test_result
    FROM calculate_challenge_rankings(v_test_challenge_id, 300)
    LIMIT 1;
    
    IF v_test_result IS NOT NULL THEN
      RAISE NOTICE '✅ Calcul réussi: user_id=%, rank=%, distance=%, rides=%', 
        v_test_result.user_id, 
        v_test_result.rank,
        v_test_result.total_distance,
        v_test_result.total_rides;
    ELSE
      RAISE NOTICE '⚠️ Aucun résultat (peut être normal si pas de trajets)';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Aucun défi actif trouvé pour tester';
  END IF;
END $$;

-- VÉRIFICATION COMPLÈTE DU SYSTÈME DE CLASSEMENTS
-- ============================================
-- Ce script vérifie que tous les éléments nécessaires sont en place
-- ============================================

-- 1. Vérifier que la table challenge_rankings existe
SELECT 
  '✅ Table challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_rankings')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 2. Vérifier les colonnes de la table
SELECT 
  '✅ Colonnes de challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'challenge_rankings' 
      AND column_name IN ('id', 'challenge_id', 'user_id', 'total_distance', 'total_rides', 'max_speed', 'rank', 'last_updated')
    )
    THEN 'OK'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL

-- 3. Vérifier que la fonction calculate_challenge_rankings existe
SELECT 
  '✅ Fonction calculate_challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'calculate_challenge_rankings'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 4. Vérifier que la fonction update_challenge_rankings existe
SELECT 
  '✅ Fonction update_challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'update_challenge_rankings'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 5. Vérifier que la fonction trigger_update_rankings_on_ride_for_challenges existe
SELECT 
  '✅ Fonction trigger_update_rankings_on_ride_for_challenges' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'trigger_update_rankings_on_ride_for_challenges'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 6. Vérifier que le trigger INSERT est activé
SELECT 
  '✅ Trigger INSERT (création trajet)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_insert'
      AND event_object_table = 'rides'
    )
    THEN 'ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL

-- 7. Vérifier que le trigger UPDATE est activé
SELECT 
  '✅ Trigger UPDATE (modification trajet)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_update'
      AND event_object_table = 'rides'
    )
    THEN 'ACTIVÉ'
    ELSE '⚠️ NON ACTIVÉ (optionnel)'
  END as status
UNION ALL

-- 8. Vérifier que la vue challenge_rankings_view existe
SELECT 
  '✅ Vue challenge_rankings_view' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'challenge_rankings_view'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 9. Vérifier que RLS est activé sur challenge_rankings
SELECT 
  '✅ RLS activé sur challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'challenge_rankings' 
      AND rowsecurity = true
    )
    THEN 'ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL

-- 10. Vérifier que la policy RLS existe
SELECT 
  '✅ Policy RLS pour challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'challenge_rankings'
      AND policyname = 'Participants peuvent voir les classements de leur défi'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 11. Vérifier que la table rides existe (nécessaire pour les triggers)
SELECT 
  '✅ Table rides' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 12. Vérifier les colonnes nécessaires dans rides
SELECT 
  '✅ Colonnes de rides (user_id, distance, max_speed, duration, start_time)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rides' 
      AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time')
      HAVING COUNT(*) = 5
    )
    THEN 'OK'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL

-- 13. Vérifier que la table challenges existe
SELECT 
  '✅ Table challenges' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenges')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 14. Vérifier que la table challenge_participants existe
SELECT 
  '✅ Table challenge_participants' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_participants')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status;

-- ============================================
-- STATISTIQUES
-- ============================================

SELECT '--- STATISTIQUES ---' as info;

-- Nombre de classements enregistrés
SELECT 
  'Nombre de classements enregistrés' as stat_name,
  COUNT(*) as value
FROM challenge_rankings;

-- Nombre de défis avec des classements
SELECT 
  'Nombre de défis avec classements' as stat_name,
  COUNT(DISTINCT challenge_id) as value
FROM challenge_rankings;

-- Nombre d'utilisateurs classés
SELECT 
  'Nombre d''utilisateurs classés' as stat_name,
  COUNT(DISTINCT user_id) as value
FROM challenge_rankings;

-- Exemple de classement (premier défi trouvé)
SELECT 
  'Exemple de classement (premier défi)' as info,
  cr.challenge_id,
  c.title as challenge_title,
  c.type as challenge_type,
  COUNT(*) as nb_participants,
  MAX(cr.rank) as meilleur_rang
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
GROUP BY cr.challenge_id, c.title, c.type
LIMIT 1;

-- ============================================
-- LISTE DES TRIGGERS ACTIFS
-- ============================================

SELECT '--- TRIGGERS ACTIFS ---' as info;

SELECT 
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  action_timing as timing,
  action_statement as function
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;

-- ============================================
-- TEST DE CALCUL (si des défis existent)
-- ============================================

SELECT '--- TEST DE CALCUL ---' as info;

-- Tester le calcul pour le premier défi actif trouvé
DO $$
DECLARE
  v_test_challenge_id UUID;
  v_test_result RECORD;
BEGIN
  -- Trouver un défi actif
  SELECT id INTO v_test_challenge_id
  FROM challenges
  WHERE (end_date IS NULL OR end_date >= NOW())
    AND (start_date IS NULL OR start_date <= NOW())
  LIMIT 1;
  
  IF v_test_challenge_id IS NOT NULL THEN
    RAISE NOTICE 'Test de calcul pour le défi: %', v_test_challenge_id;
    
    -- Tester la fonction de calcul
    SELECT * INTO v_test_result
    FROM calculate_challenge_rankings(v_test_challenge_id, 300)
    LIMIT 1;
    
    IF v_test_result IS NOT NULL THEN
      RAISE NOTICE '✅ Calcul réussi: user_id=%, rank=%, distance=%, rides=%', 
        v_test_result.user_id, 
        v_test_result.rank,
        v_test_result.total_distance,
        v_test_result.total_rides;
    ELSE
      RAISE NOTICE '⚠️ Aucun résultat (peut être normal si pas de trajets)';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Aucun défi actif trouvé pour tester';
  END IF;
END $$;

-- VÉRIFICATION COMPLÈTE DU SYSTÈME DE CLASSEMENTS
-- ============================================
-- Ce script vérifie que tous les éléments nécessaires sont en place
-- ============================================

-- 1. Vérifier que la table challenge_rankings existe
SELECT 
  '✅ Table challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_rankings')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 2. Vérifier les colonnes de la table
SELECT 
  '✅ Colonnes de challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'challenge_rankings' 
      AND column_name IN ('id', 'challenge_id', 'user_id', 'total_distance', 'total_rides', 'max_speed', 'rank', 'last_updated')
    )
    THEN 'OK'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL

-- 3. Vérifier que la fonction calculate_challenge_rankings existe
SELECT 
  '✅ Fonction calculate_challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'calculate_challenge_rankings'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 4. Vérifier que la fonction update_challenge_rankings existe
SELECT 
  '✅ Fonction update_challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'update_challenge_rankings'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 5. Vérifier que la fonction trigger_update_rankings_on_ride_for_challenges existe
SELECT 
  '✅ Fonction trigger_update_rankings_on_ride_for_challenges' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'trigger_update_rankings_on_ride_for_challenges'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 6. Vérifier que le trigger INSERT est activé
SELECT 
  '✅ Trigger INSERT (création trajet)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_insert'
      AND event_object_table = 'rides'
    )
    THEN 'ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL

-- 7. Vérifier que le trigger UPDATE est activé
SELECT 
  '✅ Trigger UPDATE (modification trajet)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_update'
      AND event_object_table = 'rides'
    )
    THEN 'ACTIVÉ'
    ELSE '⚠️ NON ACTIVÉ (optionnel)'
  END as status
UNION ALL

-- 8. Vérifier que la vue challenge_rankings_view existe
SELECT 
  '✅ Vue challenge_rankings_view' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'challenge_rankings_view'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 9. Vérifier que RLS est activé sur challenge_rankings
SELECT 
  '✅ RLS activé sur challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'challenge_rankings' 
      AND rowsecurity = true
    )
    THEN 'ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL

-- 10. Vérifier que la policy RLS existe
SELECT 
  '✅ Policy RLS pour challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'challenge_rankings'
      AND policyname = 'Participants peuvent voir les classements de leur défi'
    )
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 11. Vérifier que la table rides existe (nécessaire pour les triggers)
SELECT 
  '✅ Table rides' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 12. Vérifier les colonnes nécessaires dans rides
SELECT 
  '✅ Colonnes de rides (user_id, distance, max_speed, duration, start_time)' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rides' 
      AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time')
      HAVING COUNT(*) = 5
    )
    THEN 'OK'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL

-- 13. Vérifier que la table challenges existe
SELECT 
  '✅ Table challenges' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenges')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL

-- 14. Vérifier que la table challenge_participants existe
SELECT 
  '✅ Table challenge_participants' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_participants')
    THEN 'EXISTE'
    ELSE '❌ MANQUANTE'
  END as status;

-- ============================================
-- STATISTIQUES
-- ============================================

SELECT '--- STATISTIQUES ---' as info;

-- Nombre de classements enregistrés
SELECT 
  'Nombre de classements enregistrés' as stat_name,
  COUNT(*) as value
FROM challenge_rankings;

-- Nombre de défis avec des classements
SELECT 
  'Nombre de défis avec classements' as stat_name,
  COUNT(DISTINCT challenge_id) as value
FROM challenge_rankings;

-- Nombre d'utilisateurs classés
SELECT 
  'Nombre d''utilisateurs classés' as stat_name,
  COUNT(DISTINCT user_id) as value
FROM challenge_rankings;

-- Exemple de classement (premier défi trouvé)
SELECT 
  'Exemple de classement (premier défi)' as info,
  cr.challenge_id,
  c.title as challenge_title,
  c.type as challenge_type,
  COUNT(*) as nb_participants,
  MAX(cr.rank) as meilleur_rang
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
GROUP BY cr.challenge_id, c.title, c.type
LIMIT 1;

-- ============================================
-- LISTE DES TRIGGERS ACTIFS
-- ============================================

SELECT '--- TRIGGERS ACTIFS ---' as info;

SELECT 
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  action_timing as timing,
  action_statement as function
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;

-- ============================================
-- TEST DE CALCUL (si des défis existent)
-- ============================================

SELECT '--- TEST DE CALCUL ---' as info;

-- Tester le calcul pour le premier défi actif trouvé
DO $$
DECLARE
  v_test_challenge_id UUID;
  v_test_result RECORD;
BEGIN
  -- Trouver un défi actif
  SELECT id INTO v_test_challenge_id
  FROM challenges
  WHERE (end_date IS NULL OR end_date >= NOW())
    AND (start_date IS NULL OR start_date <= NOW())
  LIMIT 1;
  
  IF v_test_challenge_id IS NOT NULL THEN
    RAISE NOTICE 'Test de calcul pour le défi: %', v_test_challenge_id;
    
    -- Tester la fonction de calcul
    SELECT * INTO v_test_result
    FROM calculate_challenge_rankings(v_test_challenge_id, 300)
    LIMIT 1;
    
    IF v_test_result IS NOT NULL THEN
      RAISE NOTICE '✅ Calcul réussi: user_id=%, rank=%, distance=%, rides=%', 
        v_test_result.user_id, 
        v_test_result.rank,
        v_test_result.total_distance,
        v_test_result.total_rides;
    ELSE
      RAISE NOTICE '⚠️ Aucun résultat (peut être normal si pas de trajets)';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Aucun défi actif trouvé pour tester';
  END IF;
END $$;

