-- Migration: Add groups management (privacy, roles, join requests)
-- This enables:
-- 1. Public/Private groups
-- 2. Role system (owner, admin, member)
-- 3. Join request approval for private groups

-- 1. Add is_private column to groups table
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

COMMENT ON COLUMN groups.is_private IS 'Whether the group requires approval to join (true) or is open to all (false)';

-- 2. Add role column to group_members table
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member'));

COMMENT ON COLUMN group_members.role IS 'Member role: owner (creator), admin (promoted by owner), or member';

-- 3. Create group_join_requests table for private groups
CREATE TABLE IF NOT EXISTS group_join_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

COMMENT ON TABLE group_join_requests IS 'Join requests for private groups';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_join_requests_group ON group_join_requests(group_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON group_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON group_join_requests(status);
CREATE INDEX IF NOT EXISTS idx_join_requests_group_status ON group_join_requests(group_id, status);

-- 4. Auto-update updated_at on group_join_requests
CREATE OR REPLACE FUNCTION update_group_join_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_group_join_requests_updated_at
  BEFORE UPDATE ON group_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_group_join_requests_updated_at();

-- 5. Set owner role for all existing group creators
UPDATE group_members gm
SET role = 'owner'
FROM groups g
WHERE gm.group_id = g.id 
  AND gm.user_id = g.created_by
  AND (gm.role IS NULL OR gm.role = 'member');

-- 6. Ensure all groups created in the future have the creator as owner
-- This is handled in the application layer when creating a group
