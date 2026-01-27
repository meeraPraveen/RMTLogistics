-- Migration: Add User Management Fields
-- Adds name, is_active, and last_login fields to users table

-- Add name column
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add is_active column (replaces/supplements status for simpler active/inactive toggle)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add last_login column to track when user last accessed the system
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;

-- Make email unique to enforce constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Add index for is_active lookups (for filtering active/inactive users)
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Update existing users to be active by default
UPDATE users SET is_active = true WHERE is_active IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.name IS 'User full name or display name';
COMMENT ON COLUMN users.is_active IS 'Whether user account is active (can access system)';
COMMENT ON COLUMN users.last_login IS 'Timestamp of users last login to the system';

SELECT 'Migration complete! Added name, is_active, and last_login fields.' as message;
