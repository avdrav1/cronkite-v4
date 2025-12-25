-- Add is_admin column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Grant admin role to av@lab828.com
UPDATE profiles SET is_admin = true WHERE email = 'av@lab828.com';

-- Create index for admin lookups (optional but useful)
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- Add comment for documentation
COMMENT ON COLUMN profiles.is_admin IS 'Whether the user has admin privileges for feed management and system monitoring';
