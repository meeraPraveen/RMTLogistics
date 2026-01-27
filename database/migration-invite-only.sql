-- Migration: Add Invite-Only System
-- Only pre-invited users can access the application

-- Add status column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Possible status values:
-- 'active' - User has logged in and is active
-- 'suspended' - User access has been revoked

-- Add index for status lookups
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Update existing users to 'active' (they're already in the system)
UPDATE users SET status = 'active' WHERE status IS NULL OR status = 'invited';

-- Add comments for documentation
COMMENT ON COLUMN users.status IS 'User status: active (can access), suspended (blocked)';

SELECT 'Migration complete! Status field added to users table.' as message;
