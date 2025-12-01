-- Table pour les commentaires sur les trajets (rides)
CREATE TABLE IF NOT EXISTS public.ride_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_ride_comments_ride_id ON public.ride_comments(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_comments_author_id ON public.ride_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_ride_comments_created_at ON public.ride_comments(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.ride_comments ENABLE ROW LEVEL SECURITY;

-- Politique : tout le monde peut lire les commentaires
CREATE POLICY "Anyone can read ride comments"
    ON public.ride_comments
    FOR SELECT
    USING (true);

-- Politique : utilisateurs authentifiés peuvent créer des commentaires
CREATE POLICY "Authenticated users can create ride comments"
    ON public.ride_comments
    FOR INSERT
    WITH CHECK (auth.uid() = author_id);

-- Politique : les auteurs peuvent modifier leurs propres commentaires
CREATE POLICY "Users can update their own ride comments"
    ON public.ride_comments
    FOR UPDATE
    USING (auth.uid() = author_id);

-- Politique : les auteurs peuvent supprimer leurs propres commentaires
CREATE POLICY "Users can delete their own ride comments"
    ON public.ride_comments
    FOR DELETE
    USING (auth.uid() = author_id);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION public.update_ride_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour updated_at
DROP TRIGGER IF EXISTS update_ride_comments_updated_at_trigger ON public.ride_comments;
CREATE TRIGGER update_ride_comments_updated_at_trigger
    BEFORE UPDATE ON public.ride_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_ride_comments_updated_at();
