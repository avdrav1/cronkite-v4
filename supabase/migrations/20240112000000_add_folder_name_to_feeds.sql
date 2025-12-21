-- Add folder_name column to feeds table for category preservation
-- Requirements: 1.1, 1.2 - Preserve category during feed subscription

-- Add folder_name column to feeds table if not exists
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS folder_name TEXT;

-- Create index for efficient grouping by user_id and folder_name
CREATE INDEX IF NOT EXISTS idx_feeds_user_folder_name ON feeds(user_id, folder_name);

-- Add comment explaining the column purpose
COMMENT ON COLUMN feeds.folder_name IS 'Category name copied from recommended_feeds during subscription for sidebar grouping';
