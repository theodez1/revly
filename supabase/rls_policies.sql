-- Politiques RLS (Row Level Security) pour les groupes
-- À exécuter dans l'éditeur SQL de Supabase après la création des tables

-- Supprimer toutes les anciennes politiques avant de les recréer
DROP POLICY IF EXISTS "Groups are viewable by everyone" ON groups;
DROP POLICY IF EXISTS "Users can create groups" ON groups;
DROP POLICY IF EXISTS "Group owners and admins can update groups" ON groups;
DROP POLICY IF EXISTS "Group owners can update groups" ON groups;
DROP POLICY IF EXISTS "Group owners can delete groups" ON groups;

DROP POLICY IF EXISTS "Group members can view members" ON group_members;
DROP POLICY IF EXISTS "Group members are viewable by authenticated users" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Group admins can update members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups or admins can remove them" ON group_members;

DROP POLICY IF EXISTS "Group members can view challenges" ON challenges;
DROP POLICY IF EXISTS "Group members can create challenges" ON challenges;
DROP POLICY IF EXISTS "Challenge creators and group admins can update challenges" ON challenges;
DROP POLICY IF EXISTS "Challenge creators and group admins can delete challenges" ON challenges;

DROP POLICY IF EXISTS "Group members can view challenge participants" ON challenge_participants;
DROP POLICY IF EXISTS "Group members can update their own progress" ON challenge_participants;

DROP POLICY IF EXISTS "Group members can view posts" ON group_posts;
DROP POLICY IF EXISTS "Group members can create posts" ON group_posts;
DROP POLICY IF EXISTS "Post authors can update their posts" ON group_posts;
DROP POLICY IF EXISTS "Post authors and group admins can delete posts" ON group_posts;

DROP POLICY IF EXISTS "Group members can view post likes" ON post_likes;
DROP POLICY IF EXISTS "Group members can toggle their own likes" ON post_likes;

DROP POLICY IF EXISTS "Group members can view post comments" ON post_comments;
DROP POLICY IF EXISTS "Group members can create comments" ON post_comments;
DROP POLICY IF EXISTS "Comment authors can update their comments" ON post_comments;
DROP POLICY IF EXISTS "Comment authors and group admins can delete comments" ON post_comments;

DROP POLICY IF EXISTS "Invited users and group admins can view invitations" ON group_invitations;
DROP POLICY IF EXISTS "Group members can create invitations" ON group_invitations;
DROP POLICY IF EXISTS "Invited users can update invitations" ON group_invitations;
DROP POLICY IF EXISTS "Group admins can delete invitations" ON group_invitations;

-- Activer RLS sur toutes les tables
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

-- ========== POLITIQUES POUR groups ==========

-- Lecture publique pour tous les groupes
CREATE POLICY "Groups are viewable by everyone"
  ON groups FOR SELECT
  USING (true);

-- Création : n'importe qui peut créer un groupe
CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Mise à jour : seulement le créateur ou les admins du groupe
CREATE POLICY "Group owners and admins can update groups"
  ON groups FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
        AND group_members.user_id = auth.uid()
        AND group_members.role IN ('owner', 'admin')
        AND group_members.status = 'active'
    )
  );

-- Suppression : seulement le créateur
CREATE POLICY "Group owners can delete groups"
  ON groups FOR DELETE
  USING (auth.uid() = created_by);

-- ========== POLITIQUES POUR group_members ==========

-- Lecture : permettre à tous les utilisateurs authentifiés de voir les membres
-- (on peut restreindre plus tard si nécessaire, mais cela évite la récursion infinie)
CREATE POLICY "Group members are viewable by authenticated users"
  ON group_members FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insertion : n'importe qui peut rejoindre (ou être ajouté par un admin)
CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour : seulement les admins du groupe (utiliser IN pour éviter la récursion)
CREATE POLICY "Group admins can update members"
  ON group_members FOR UPDATE
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- Suppression : l'utilisateur lui-même ou un admin
CREATE POLICY "Users can leave groups or admins can remove them"
  ON group_members FOR DELETE
  USING (
    auth.uid() = user_id OR
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- ========== POLITIQUES POUR challenges ==========

-- Lecture : membres du groupe (utiliser IN pour éviter la récursion)
CREATE POLICY "Group members can view challenges"
  ON challenges FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Création : membres du groupe
CREATE POLICY "Group members can create challenges"
  ON challenges FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Mise à jour : créateur ou admins du groupe
CREATE POLICY "Challenge creators and group admins can update challenges"
  ON challenges FOR UPDATE
  USING (
    auth.uid() = created_by OR
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- Suppression : créateur ou admins du groupe
CREATE POLICY "Challenge creators and group admins can delete challenges"
  ON challenges FOR DELETE
  USING (
    auth.uid() = created_by OR
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- ========== POLITIQUES POUR challenge_participants ==========

-- Lecture : membres du groupe
CREATE POLICY "Group members can view challenge participants"
  ON challenge_participants FOR SELECT
  USING (
    challenge_id IN (
      SELECT c.id FROM challenges c
      JOIN group_members gm ON gm.group_id = c.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Insertion/Mise à jour : membres du groupe pour leur propre progrès
CREATE POLICY "Group members can update their own progress"
  ON challenge_participants FOR ALL
  USING (
    auth.uid() = user_id AND
    challenge_id IN (
      SELECT c.id FROM challenges c
      JOIN group_members gm ON gm.group_id = c.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    challenge_id IN (
      SELECT c.id FROM challenges c
      JOIN group_members gm ON gm.group_id = c.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- ========== POLITIQUES POUR group_posts ==========

-- Lecture : membres du groupe
CREATE POLICY "Group members can view posts"
  ON group_posts FOR SELECT
  USING (
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Création : membres du groupe
CREATE POLICY "Group members can create posts"
  ON group_posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Mise à jour : auteur du post
CREATE POLICY "Post authors can update their posts"
  ON group_posts FOR UPDATE
  USING (auth.uid() = author_id);

-- Suppression : auteur du post ou admins du groupe
CREATE POLICY "Post authors and group admins can delete posts"
  ON group_posts FOR DELETE
  USING (
    auth.uid() = author_id OR
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- ========== POLITIQUES POUR post_likes ==========

-- Lecture : membres du groupe
CREATE POLICY "Group members can view post likes"
  ON post_likes FOR SELECT
  USING (
    post_id IN (
      SELECT gp.id FROM group_posts gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Insertion/Suppression : membres du groupe pour leur propre like
CREATE POLICY "Group members can toggle their own likes"
  ON post_likes FOR ALL
  USING (
    auth.uid() = user_id AND
    post_id IN (
      SELECT gp.id FROM group_posts gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND
    post_id IN (
      SELECT gp.id FROM group_posts gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- ========== POLITIQUES POUR post_comments ==========

-- Lecture : membres du groupe
CREATE POLICY "Group members can view post comments"
  ON post_comments FOR SELECT
  USING (
    post_id IN (
      SELECT gp.id FROM group_posts gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Création : membres du groupe
CREATE POLICY "Group members can create comments"
  ON post_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    post_id IN (
      SELECT gp.id FROM group_posts gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Mise à jour : auteur du commentaire
CREATE POLICY "Comment authors can update their comments"
  ON post_comments FOR UPDATE
  USING (auth.uid() = author_id);

-- Suppression : auteur du commentaire ou admins du groupe
CREATE POLICY "Comment authors and group admins can delete comments"
  ON post_comments FOR DELETE
  USING (
    auth.uid() = author_id OR
    post_id IN (
      SELECT gp.id FROM group_posts gp
      JOIN group_members gm ON gm.group_id = gp.group_id
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- ========== POLITIQUES POUR group_invitations ==========

-- Lecture : utilisateur invité ou admins du groupe
CREATE POLICY "Invited users and group admins can view invitations"
  ON group_invitations FOR SELECT
  USING (
    auth.uid() = invited_user_id OR
    auth.uid() = invited_by OR
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid()
        AND gm.role IN ('owner', 'admin')
        AND gm.status = 'active'
    )
  );

-- Création : membres du groupe (pour inviter)
CREATE POLICY "Group members can create invitations"
  ON group_invitations FOR INSERT
  WITH CHECK (
    auth.uid() = invited_by AND
    group_id IN (
      SELECT gm.group_id FROM group_members gm
      WHERE gm.user_id = auth.uid() AND gm.status = 'active'
    )
  );

-- Mise à jour : utilisateur invité (pour accepter/refuser)
CREATE POLICY "Invited users can update invitations"
  ON group_invitations FOR UPDATE
  USING (auth.uid() = invited_user_id);

