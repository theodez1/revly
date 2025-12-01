-- Table pour les préférences utilisateur liées au feed
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    preferred_vehicles TEXT[] DEFAULT ARRAY['car'],
    home_city TEXT,
    home_location JSONB, -- {latitude: number, longitude: number}
    feed_algorithm_version TEXT DEFAULT 'v1',
    show_nearby_content BOOLEAN DEFAULT true,
    show_group_content BOOLEAN DEFAULT true,
    show_following_only BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security)
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Politique : utilisateurs peuvent voir leurs propres préférences
CREATE POLICY "Users can view own preferences"
    ON public.user_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Politique : utilisateurs peuvent créer leurs préférences
CREATE POLICY "Users can create own preferences"
    ON public.user_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Politique : utilisateurs peuvent modifier leurs préférences
CREATE POLICY "Users can update own preferences"
    ON public.user_preferences
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at_trigger
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_preferences_updated_at();
