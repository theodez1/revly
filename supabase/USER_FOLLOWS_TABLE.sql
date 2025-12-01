-- Table pour le système de follow (abonnements entre utilisateurs)
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id) -- Un utilisateur ne peut pas se suivre lui-même
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON public.user_follows(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- Politique : tout le monde peut voir qui suit qui
CREATE POLICY "Anyone can view follows"
    ON public.user_follows
    FOR SELECT
    USING (true);

-- Politique : utilisateurs authentifiés peuvent créer des follows (seulement pour eux-mêmes)
CREATE POLICY "Users can follow others"
    ON public.user_follows
    FOR INSERT
    WITH CHECK (auth.uid() = follower_id);

-- Politique : utilisateurs peuvent supprimer leurs propres follows
CREATE POLICY "Users can unfollow"
    ON public.user_follows
    FOR DELETE
    USING (auth.uid() = follower_id);

-- Fonction pour compter les followers d'un utilisateur
CREATE OR REPLACE FUNCTION public.count_followers(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.user_follows WHERE following_id = user_id);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour compter les following d'un utilisateur
CREATE OR REPLACE FUNCTION public.count_following(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM public.user_follows WHERE follower_id = user_id);
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier si un utilisateur suit un autre
CREATE OR REPLACE FUNCTION public.is_following(follower UUID, following UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_follows 
        WHERE follower_id = follower AND following_id = following
    );
END;
$$ LANGUAGE plpgsql;
