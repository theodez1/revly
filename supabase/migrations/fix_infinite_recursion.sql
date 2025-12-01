-- Fix Infinite Recursion in RLS policies
-- The previous policies caused infinite recursion because checking if someone is an admin/member
-- required querying group_members, which triggered the policy again.

-- 1. Create secure functions to check status
-- SECURITY DEFINER means these functions run with the privileges of the creator (postgres/admin)
-- bypassing RLS checks on the table itself.

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

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Admins can add members" ON group_members;
DROP POLICY IF EXISTS "Admins can update members" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Admins can remove members" ON group_members;
DROP POLICY IF EXISTS "Members can view group members" ON group_members;

-- 3. Recreate policies using the secure functions

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
  -- OR the group is public
  EXISTS (
    SELECT 1 FROM groups g
    WHERE g.id = group_members.group_id
    AND g.is_private = false
  )
);
