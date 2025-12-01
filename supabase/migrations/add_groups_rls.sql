-- Enable RLS on groups table
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 1. SELECT Policy
DROP POLICY IF EXISTS "Groups are viewable by everyone" ON groups;
-- Public groups are visible to everyone
-- Private groups are visible to members
CREATE POLICY "Groups are viewable by everyone" ON groups
FOR SELECT
USING (
  is_private = false
  OR
  auth.uid() = created_by
  OR
  EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = groups.id
    AND user_id = auth.uid()
  )
);

-- 2. INSERT Policy
DROP POLICY IF EXISTS "Users can create groups" ON groups;
-- Authenticated users can create groups
CREATE POLICY "Users can create groups" ON groups
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
);

-- 3. UPDATE Policy
DROP POLICY IF EXISTS "Owners can update groups" ON groups;
-- Only the owner (created_by) can update the group
CREATE POLICY "Owners can update groups" ON groups
FOR UPDATE
USING (
  auth.uid() = created_by
);

-- 4. DELETE Policy
DROP POLICY IF EXISTS "Owners can delete groups" ON groups;
-- Only the owner (created_by) can delete the group
CREATE POLICY "Owners can delete groups" ON groups
FOR DELETE
USING (
  auth.uid() = created_by
);
