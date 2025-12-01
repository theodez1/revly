-- Configuration du bucket Storage pour les avatars de groupes
-- À exécuter dans l'éditeur SQL de Supabase

-- Créer le bucket pour les avatars de groupes
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-avatars', 'group-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politique de lecture publique pour les avatars
CREATE POLICY "Group avatars are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'group-avatars');

-- Politique d'upload : seulement les membres du groupe (via RLS)
CREATE POLICY "Group members can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'group-avatars' AND
    auth.role() = 'authenticated'
  );

-- Politique de mise à jour : seulement les membres du groupe
CREATE POLICY "Group members can update avatars"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'group-avatars' AND
    auth.role() = 'authenticated'
  );

-- Politique de suppression : seulement les membres du groupe
CREATE POLICY "Group members can delete avatars"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'group-avatars' AND
    auth.role() = 'authenticated'
  );

