-- Fix RLS policies for group_members to allow admin management

-- 1. Enable RLS (if not already enabled)
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- 2. Policy for INSERT: 
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
-- Allow users to join (add themselves)
CREATE POLICY "Users can join groups" ON group_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Admins can add members" ON group_members;
-- Allow admins/owners to add members (approve requests)
CREATE POLICY "Admins can add members" ON group_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  )
);

-- 3. Policy for UPDATE:
DROP POLICY IF EXISTS "Admins can update members" ON group_members;
-- Allow admins/owners to update member roles (promote/demote)
CREATE POLICY "Admins can update members" ON group_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  )
);

-- 4. Policy for DELETE:
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
-- Allow users to leave (remove themselves)
CREATE POLICY "Users can leave groups" ON group_members
FOR DELETE
USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Admins can remove members" ON group_members;
-- Allow admins/owners to remove members (kick)
CREATE POLICY "Admins can remove members" ON group_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  )
);

-- 5. Policy for SELECT:
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
-- Allow members to see other members
CREATE POLICY "Members can view group members" ON group_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
  )
  OR
  -- Also allow viewing members of public groups (optional, depending on privacy needs)
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.is_private = false
  )
);
