-- Migration: Create user_sessions table for Express session storage
-- This table is required by connect-pg-simple for persistent session storage

-- Create the user_sessions table with the schema expected by connect-pg-simple
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid")
);

-- Create index on expire column for efficient session pruning
CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");

-- Grant necessary permissions for the session table
-- Note: In Supabase, the postgres role has full access by default

-- Add comment for documentation
COMMENT ON TABLE "user_sessions" IS 'Express session storage table for connect-pg-simple';
