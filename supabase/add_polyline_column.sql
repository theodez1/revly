-- Migration: Ajouter la colonne polyline à la table rides
-- À exécuter dans le SQL Editor du Dashboard Supabase

-- Ajouter la colonne polyline (sans NOT NULL d'abord pour permettre les valeurs NULL lors de la migration)
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS polyline TEXT;

-- Rendre route_coordinates NULLable si elle était NOT NULL
ALTER TABLE public.rides 
ALTER COLUMN route_coordinates DROP NOT NULL;

-- Pour les trajets existants sans polyline, on garde route_coordinates comme backup
-- Les nouveaux trajets utiliseront uniquement polyline

