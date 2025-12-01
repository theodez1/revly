-- Add JSONB column to hold advanced ride statistics
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS extra_stats JSONB DEFAULT '{}'::jsonb;

-- Ensure existing rows have a non-null JSON object
UPDATE public.rides
SET extra_stats = COALESCE(extra_stats, '{}'::jsonb);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rides'
      AND column_name = 'elevation_gain'
  ) THEN
    EXECUTE $SQL$
      UPDATE public.rides
      SET extra_stats = jsonb_strip_nulls(
        extra_stats ||
        jsonb_build_object(
          'elevationGain', elevation_gain,
          'elevationLoss', elevation_loss,
          'climbRate', CASE
            WHEN moving_time IS NOT NULL AND moving_time > 0 AND elevation_gain IS NOT NULL
            THEN elevation_gain / (moving_time / 3600.0)
            ELSE NULL
          END,
          'averageGrade', CASE
            WHEN distance IS NOT NULL AND distance > 0 AND elevation_gain IS NOT NULL
            THEN (elevation_gain / distance) * 100
            ELSE NULL
          END,
          'idleRatio', CASE
            WHEN duration IS NOT NULL AND duration > 0 AND total_stop_time IS NOT NULL
            THEN (total_stop_time::numeric / duration) * 100
            ELSE NULL
          END,
          'stopsPerKm', CASE
            WHEN distance IS NOT NULL AND distance > 0 AND total_stops IS NOT NULL
            THEN total_stops::numeric / (distance / 1000.0)
            ELSE NULL
          END,
          'movingRatio', CASE
            WHEN duration IS NOT NULL AND duration > 0 AND moving_time IS NOT NULL
            THEN (moving_time::numeric / duration) * 100
            ELSE NULL
          END
        )
      );
    $SQL$;
  END IF;
END
$$;

-- Drop legacy elevation columns now that data is stored inside extra_stats
ALTER TABLE public.rides
  DROP COLUMN IF EXISTS elevation_gain,
  DROP COLUMN IF EXISTS elevation_loss;

