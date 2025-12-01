-- Script pour ajouter la colonne cities à la table rides
-- À exécuter dans le SQL Editor du Dashboard Supabase

-- Ajouter la colonne cities si elle n'existe pas
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS cities JSONB DEFAULT '[]'::jsonb;

-- Migrer les données existantes : créer cities à partir de start_city et end_city
UPDATE public.rides 
SET cities = 
  CASE 
    WHEN start_city IS NOT NULL AND end_city IS NOT NULL AND start_city != end_city THEN
      jsonb_build_array(start_city, end_city)
    WHEN start_city IS NOT NULL THEN
      jsonb_build_array(start_city)
    WHEN end_city IS NOT NULL THEN
      jsonb_build_array(end_city)
    ELSE
      '[]'::jsonb
  END
WHERE cities IS NULL OR cities = '[]'::jsonb;

-- Optionnel: Supprimer les colonnes start_city et end_city après migration
-- ALTER TABLE public.rides DROP COLUMN IF EXISTS start_city;
-- ALTER TABLE public.rides DROP COLUMN IF EXISTS end_city;
