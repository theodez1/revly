-- Fix Infinite Recursion V2
-- The loop is likely: group_members policy -> queries groups -> groups policy -> queries group_members
-- Solution: Use SECURITY DEFINER functions for ALL table lookups in policies.

-- 1. Create SECURITY DEFINER function to check if group is public
-- This bypasses RLS on 'groups' table, preventing the loop.
CREATE OR REPLACE FUNCTION is_group_public(check_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM groups
    WHERE id = check_group_id
    AND is_private = false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure other functions are present and secure
CREATE OR REPLACE FUNCTION is_group_member(check_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_group_admin(check_group_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = check_group_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Drop ALL existing policies on group_members to be sure
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Admins can add members" ON group_members;
DROP POLICY IF EXISTS "Admins can update members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Members can view group members" ON group_members;
-- Drop potential duplicates from previous attempts
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON group_members;
DROP POLICY IF EXISTS "Admins can manage members" ON group_members;

-- 4. Recreate policies using ONLY the secure functions

-- INSERT
CREATE POLICY "Users can join groups" ON group_members
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Admins can add members" ON group_members
FOR INSERT
WITH CHECK (
  is_group_admin(group_id)
);

-- UPDATE
CREATE POLICY "Admins can update members" ON group_members
FOR UPDATE
USING (
  is_group_admin(group_id)
);

-- DELETE
CREATE POLICY "Users can leave groups" ON group_members
FOR DELETE
USING (
  auth.uid() = user_id
);

CREATE POLICY "Admins can remove members" ON group_members
FOR DELETE
USING (
  is_group_admin(group_id)
);

-- SELECT
CREATE POLICY "Members can view group members" ON group_members
FOR SELECT
USING (
  -- User is looking at their own row
  (auth.uid() = user_id)
  OR
  -- OR user is a member of the group (checked securely)
  is_group_member(group_id)
  OR
  -- OR the group is public (checked securely via function)
  is_group_public(group_id)
);
