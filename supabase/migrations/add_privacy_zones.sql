-- Migration: Add privacy zones to rides table
-- This allows users to hide the start/end of their rides to protect their home address

-- Add privacy columns
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS privacy_start_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_end_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS privacy_start_km DECIMAL(4,2) DEFAULT 0.3,
ADD COLUMN IF NOT EXISTS privacy_end_km DECIMAL(4,2) DEFAULT 0.3;

-- Add comments for documentation
COMMENT ON COLUMN rides.privacy_start_enabled IS 'Whether to hide the start of the ride for privacy';
COMMENT ON COLUMN rides.privacy_end_enabled IS 'Whether to hide the end of the ride for privacy';
COMMENT ON COLUMN rides.privacy_start_km IS 'Number of kilometers to hide from the start (default 0.3km = 300m)';
COMMENT ON COLUMN rides.privacy_end_km IS 'Number of kilometers to hide from the end (default 0.3km = 300m)';

-- Update existing rides to have default values
UPDATE rides 
SET privacy_start_enabled = false,
    privacy_end_enabled = false,
    privacy_start_km = 0.3,
    privacy_end_km = 0.3
WHERE privacy_start_enabled IS NULL 
   OR privacy_end_enabled IS NULL;

-- Add check constraints to ensure valid values (max 2km)
ALTER TABLE rides 
ADD CONSTRAINT privacy_start_km_valid CHECK (privacy_start_km >= 0 AND privacy_start_km <= 2.0);

ALTER TABLE rides 
ADD CONSTRAINT privacy_end_km_valid CHECK (privacy_end_km >= 0 AND privacy_end_km <= 2.0);
