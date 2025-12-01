-- Script pour corriger les policies Storage
-- À exécuter dans le SQL Editor de Supabase Dashboard

-- ========================================
-- NETTOYER LES ANCIENNES POLICIES
-- ========================================

-- Supprimer toutes les anciennes policies sur storage.objects
DROP POLICY IF EXISTS "Utilisateurs peuvent uploader leur avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatars sont publics" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leur avatar" ON storage.objects;

DROP POLICY IF EXISTS "Utilisateurs peuvent uploader des photos de trajets" ON storage.objects;
DROP POLICY IF EXISTS "Photos de trajets sont publiques" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent mettre à jour leurs photos de trajets" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leurs photos" ON storage.objects;

DROP POLICY IF EXISTS "Utilisateurs peuvent uploader des photos de véhicules" ON storage.objects;
DROP POLICY IF EXISTS "Photos de véhicules sont publiques" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent mettre à jour leurs photos de véhicules" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateurs peuvent supprimer leurs photos de véhicules" ON storage.objects;

-- ========================================
-- POLICIES POUR AVATARS
-- ========================================

-- INSERT: L'utilisateur peut uploader dans son propre dossier
CREATE POLICY "Utilisateurs peuvent uploader leur avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: Tout le monde peut voir les avatars (public)
CREATE POLICY "Avatars sont publics"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- UPDATE: L'utilisateur peut mettre à jour son propre avatar
CREATE POLICY "Utilisateurs peuvent mettre à jour leur avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: L'utilisateur peut supprimer son propre avatar
CREATE POLICY "Utilisateurs peuvent supprimer leur avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ========================================
-- POLICIES POUR RIDE-PHOTOS
-- ========================================

-- INSERT: L'utilisateur peut uploader dans son propre dossier
CREATE POLICY "Utilisateurs peuvent uploader des photos de trajets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ride-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: Tout le monde peut voir les photos de trajets (public)
CREATE POLICY "Photos de trajets sont publiques"
ON storage.objects FOR SELECT
USING (bucket_id = 'ride-photos');

-- UPDATE: L'utilisateur peut mettre à jour ses propres photos
CREATE POLICY "Utilisateurs peuvent mettre à jour leurs photos de trajets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ride-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: L'utilisateur peut supprimer ses propres photos
CREATE POLICY "Utilisateurs peuvent supprimer leurs photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ride-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ========================================
-- POLICIES POUR VEHICLE-PHOTOS
-- ========================================

-- INSERT: L'utilisateur peut uploader dans son propre dossier
CREATE POLICY "Utilisateurs peuvent uploader des photos de véhicules"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT: Tout le monde peut voir les photos de véhicules (public)
CREATE POLICY "Photos de véhicules sont publiques"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-photos');

-- UPDATE: L'utilisateur peut mettre à jour ses propres photos de véhicules
CREATE POLICY "Utilisateurs peuvent mettre à jour leurs photos de véhicules"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicle-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: L'utilisateur peut supprimer ses propres photos de véhicules
CREATE POLICY "Utilisateurs peuvent supprimer leurs photos de véhicules"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicle-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ========================================
-- VÉRIFICATION
-- ========================================

-- Lister toutes les policies sur storage.objects
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Message de confirmation
DO $$
BEGIN
  RAISE NOTICE '✅ Policies Storage mises à jour avec succès!';
  RAISE NOTICE 'Les utilisateurs peuvent maintenant uploader des photos dans leurs propres dossiers.';
END $$;







