-- ============================================
-- VÉRIFICATION COMPLÈTE DU SYSTÈME DE CLASSEMENTS
-- ============================================
-- Ce script vérifie TOUT : tables, fonctions, triggers, données, etc.
-- ============================================

-- ============================================
-- 1. VÉRIFICATION DES TABLES
-- ============================================

SELECT '1. VÉRIFICATION DES TABLES' as section;

SELECT 
  'Table challenge_rankings' as element,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_rankings')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL
SELECT 
  'Table rides',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rides')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END
UNION ALL
SELECT 
  'Table challenges',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenges')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END
UNION ALL
SELECT 
  'Table challenge_participants',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_participants')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END;

-- ============================================
-- 2. VÉRIFICATION DES COLONNES
-- ============================================

SELECT '2. VÉRIFICATION DES COLONNES' as section;

SELECT 
  'Colonnes challenge_rankings' as check_name,
  CASE 
    WHEN (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_name = 'challenge_rankings' 
      AND column_name IN ('id', 'challenge_id', 'user_id', 'total_distance', 'total_rides', 'max_speed', 'rank', 'last_updated')
    ) = 8
    THEN '✅ TOUTES PRÉSENTES'
    ELSE '❌ COLONNES MANQUANTES'
  END as status
UNION ALL
SELECT 
  'Colonnes rides (user_id, distance, max_speed, duration, start_time)',
  CASE 
    WHEN (
      SELECT COUNT(*) FROM information_schema.columns 
      WHERE table_name = 'rides' 
      AND column_name IN ('user_id', 'distance', 'max_speed', 'duration', 'start_time')
    ) = 5
    THEN '✅ TOUTES PRÉSENTES'
    ELSE '❌ COLONNES MANQUANTES'
  END;

-- ============================================
-- 3. VÉRIFICATION DES FONCTIONS
-- ============================================

SELECT '3. VÉRIFICATION DES FONCTIONS' as section;

SELECT 
  'calculate_challenge_rankings' as fonction,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_challenge_rankings')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END as status
UNION ALL
SELECT 
  'update_challenge_rankings',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_challenge_rankings')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END
UNION ALL
SELECT 
  'trigger_update_rankings_on_ride_for_challenges',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'trigger_update_rankings_on_ride_for_challenges')
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END;

-- ============================================
-- 4. VÉRIFICATION DES TRIGGERS
-- ============================================

SELECT '4. VÉRIFICATION DES TRIGGERS' as section;

SELECT 
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  CASE 
    WHEN trigger_name IS NOT NULL
    THEN '✅ ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;

-- Vérification détaillée
SELECT 
  'Trigger INSERT' as trigger_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_insert'
      AND event_object_table = 'rides'
    )
    THEN '✅ ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL
SELECT 
  'Trigger UPDATE',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_update'
      AND event_object_table = 'rides'
    )
    THEN '✅ ACTIVÉ'
    ELSE '⚠️ NON ACTIVÉ (optionnel)'
  END
UNION ALL
SELECT 
  'Trigger DELETE',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'update_challenge_rankings_on_ride_delete'
      AND event_object_table = 'rides'
    )
    THEN '✅ ACTIVÉ'
    ELSE '⚠️ NON ACTIVÉ (optionnel)'
  END;

-- ============================================
-- 5. VÉRIFICATION RLS
-- ============================================

SELECT '5. VÉRIFICATION RLS' as section;

SELECT 
  'RLS activé sur challenge_rankings' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'challenge_rankings' 
      AND rowsecurity = true
    )
    THEN '✅ ACTIVÉ'
    ELSE '❌ NON ACTIVÉ'
  END as status
UNION ALL
SELECT 
  'Policy RLS pour challenge_rankings',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'challenge_rankings'
      AND policyname = 'Participants peuvent voir les classements de leur défi'
    )
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END;

-- ============================================
-- 6. VÉRIFICATION DE LA VUE
-- ============================================

SELECT '6. VÉRIFICATION DE LA VUE' as section;

SELECT 
  'Vue challenge_rankings_view' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views 
      WHERE table_name = 'challenge_rankings_view'
    )
    THEN '✅ EXISTE'
    ELSE '❌ MANQUANTE'
  END as status;

-- ============================================
-- 7. STATISTIQUES
-- ============================================

SELECT '7. STATISTIQUES' as section;

-- Nombre de classements enregistrés
SELECT 
  'Nombre de classements enregistrés' as stat_name,
  COUNT(*)::TEXT as value
FROM challenge_rankings;

-- Nombre de défis avec des classements
SELECT 
  'Nombre de défis avec classements' as stat_name,
  COUNT(DISTINCT challenge_id)::TEXT as value
FROM challenge_rankings;

-- Nombre d'utilisateurs classés
SELECT 
  'Nombre d''utilisateurs classés' as stat_name,
  COUNT(DISTINCT user_id)::TEXT as value
FROM challenge_rankings;

-- Nombre de défis actifs
SELECT 
  'Nombre de défis actifs' as stat_name,
  COUNT(*)::TEXT as value
FROM challenges
WHERE (end_date IS NULL OR end_date >= NOW())
  AND (start_date IS NULL OR start_date <= NOW());

-- Nombre de participants aux défis
SELECT 
  'Nombre de participants aux défis' as stat_name,
  COUNT(DISTINCT user_id)::TEXT as value
FROM challenge_participants;

-- ============================================
-- 8. EXEMPLE DE CLASSEMENT
-- ============================================

SELECT '8. EXEMPLE DE CLASSEMENT' as section;

-- Afficher un exemple de classement (premier défi trouvé)
SELECT 
  cr.challenge_id,
  c.title as challenge_title,
  c.type as challenge_type,
  COUNT(*) as nb_participants,
  MAX(cr.rank) as meilleur_rang,
  MIN(cr.rank) as dernier_rang
FROM challenge_rankings cr
INNER JOIN challenges c ON cr.challenge_id = c.id
GROUP BY cr.challenge_id, c.title, c.type
LIMIT 1;

-- ============================================
-- 9. VÉRIFICATION DES INDEX
-- ============================================

SELECT '9. VÉRIFICATION DES INDEX' as section;

SELECT 
  indexname as index_name,
  '✅ EXISTE' as status
FROM pg_indexes
WHERE tablename = 'challenge_rankings'
  AND indexname LIKE 'idx_challenge_rankings%'
ORDER BY indexname;

-- ============================================
-- 10. TEST DE CALCUL
-- ============================================

SELECT '10. TEST DE CALCUL' as section;

-- Tester le calcul pour le premier défi actif trouvé
DO $$
DECLARE
  v_test_challenge_id UUID;
  v_test_result RECORD;
  v_test_count INTEGER := 0;
BEGIN
  -- Trouver un défi actif
  SELECT id INTO v_test_challenge_id
  FROM challenges
  WHERE (end_date IS NULL OR end_date >= NOW())
    AND (start_date IS NULL OR start_date <= NOW())
  LIMIT 1;
  
  IF v_test_challenge_id IS NOT NULL THEN
    -- Tester la fonction de calcul
    FOR v_test_result IN
      SELECT * FROM calculate_challenge_rankings(v_test_challenge_id, 300)
      LIMIT 5
    LOOP
      v_test_count := v_test_count + 1;
    END LOOP;
    
    IF v_test_count > 0 THEN
      RAISE NOTICE '✅ Calcul réussi: % résultat(s) trouvé(s) pour le défi %', v_test_count, v_test_challenge_id;
    ELSE
      RAISE NOTICE '⚠️ Aucun résultat (peut être normal si pas de trajets) pour le défi %', v_test_challenge_id;
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Aucun défi actif trouvé pour tester';
  END IF;
END $$;

-- ============================================
-- 11. RÉSUMÉ FINAL
-- ============================================

SELECT '11. RÉSUMÉ FINAL' as section;

SELECT 
  'Système opérationnel' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'challenge_rankings')
      AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'calculate_challenge_rankings')
      AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_challenge_rankings')
      AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_challenge_rankings_on_ride_insert')
    THEN '✅ OUI - Tout est en place'
    ELSE '❌ NON - Vérifiez les erreurs ci-dessus'
  END as status;

-- ============================================
-- 12. LISTE DES TRIGGERS ACTIFS
-- ============================================

SELECT '12. LISTE DES TRIGGERS ACTIFS' as section;

SELECT 
  trigger_name,
  event_manipulation as event,
  event_object_table as table_name,
  action_timing as timing
FROM information_schema.triggers
WHERE trigger_name LIKE '%challenge_rankings%'
ORDER BY trigger_name;
