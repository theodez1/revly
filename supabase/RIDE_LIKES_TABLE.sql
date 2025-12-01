-- Table pour les likes sur les trajets
CREATE TABLE IF NOT EXISTS public.ride_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(ride_id, user_id) -- Un utilisateur ne peut liker qu'une fois par trajet
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_ride_likes_ride_id ON public.ride_likes(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_likes_user_id ON public.ride_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_ride_likes_created_at ON public.ride_likes(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.ride_likes ENABLE ROW LEVEL SECURITY;

-- Politique : tout le monde peut voir les likes
CREATE POLICY "Anyone can view ride likes"
    ON public.ride_likes
    FOR SELECT
    USING (true);

-- Politique : utilisateurs authentifiés peuvent créer des likes
CREATE POLICY "Authenticated users can like rides"
    ON public.ride_likes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Politique : utilisateurs peuvent supprimer leurs propres likes
CREATE POLICY "Users can unlike rides"
    ON public.ride_likes
    FOR DELETE
    USING (auth.uid() = user_id);

-- Fonction pour compter les likes d'un trajet
CREATE OR REPLACE FUNCTION public.count_ride_likes(ride_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.ride_likes WHERE ride_id = ride_uuid);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur a liké un trajet
CREATE OR REPLACE FUNCTION public.has_liked_ride(user_uuid UUID, ride_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.ride_likes 
        WHERE user_id = user_uuid AND ride_id = ride_uuid
    );
END;
$$ LANGUAGE plpgsql;
