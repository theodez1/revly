# Configuration des buckets Storage Supabase

## Instructions

Connectez-vous au Dashboard Supabase et allez dans **Storage** pour créer les buckets suivants:

### 1. Bucket `avatars`
- **Public**: Oui
- **File size limit**: 2 MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

### 2. Bucket `ride-photos`
- **Public**: Oui
- **File size limit**: 5 MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

### 3. Bucket `vehicle-photos`
- **Public**: Oui
- **File size limit**: 2 MB
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

## Policies Storage (RLS)

Pour chaque bucket, configurez les policies suivantes via le Dashboard:

### avatars
```sql
-- INSERT policy
CREATE POLICY "Utilisateurs peuvent uploader leur avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT policy  
CREATE POLICY "Avatars sont publics"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- DELETE policy
CREATE POLICY "Utilisateurs peuvent supprimer leur avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### ride-photos
```sql
-- INSERT policy
CREATE POLICY "Utilisateurs peuvent uploader des photos de trajets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'ride-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT policy
CREATE POLICY "Photos de trajets sont publiques"
ON storage.objects FOR SELECT
USING (bucket_id = 'ride-photos');

-- UPDATE policy (pour upsert)
CREATE POLICY "Utilisateurs peuvent mettre à jour leurs photos de trajets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'ride-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE policy
CREATE POLICY "Utilisateurs peuvent supprimer leurs photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'ride-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### vehicle-photos
```sql
-- INSERT policy
CREATE POLICY "Utilisateurs peuvent uploader des photos de véhicules"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vehicle-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- SELECT policy
CREATE POLICY "Photos de véhicules sont publiques"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-photos');

-- UPDATE policy (pour upsert)
CREATE POLICY "Utilisateurs peuvent mettre à jour leurs photos de véhicules"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'vehicle-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE policy
CREATE POLICY "Utilisateurs peuvent supprimer leurs photos de véhicules"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'vehicle-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

## Structure des fichiers

### avatars
```
avatars/
  {user_id}/
    avatar.jpg
```

### ride-photos
```
ride-photos/
  {user_id}/
    {ride_id}/
      {timestamp}.jpg
```

### vehicle-photos
```
vehicle-photos/
  {user_id}/
    {vehicle_id}/
      photo.jpg
```

