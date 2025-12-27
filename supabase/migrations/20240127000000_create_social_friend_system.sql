-- Create social friend system tables and enums
-- Requirements: 1.1-8.5 (foundational data layer for social features)

-- Create enums for social system
CREATE TYPE friendship_status AS ENUM ('pending', 'confirmed', 'declined');
CREATE TYPE notification_type AS ENUM ('friend_request', 'friend_accepted', 'comment_tag', 'comment_reply');
CREATE TYPE privacy_level AS ENUM ('everyone', 'friends', 'nobody');

-- Create friendships table for managing friend relationships
-- Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  requested_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure friendship uniqueness and proper ordering
  CONSTRAINT friendship_unique UNIQUE (user1_id, user2_id),
  CONSTRAINT friendship_no_self CHECK (user1_id != user2_id),
  CONSTRAINT friendship_ordered CHECK (user1_id < user2_id),
  -- Ensure requested_by is one of the two users
  CONSTRAINT friendship_valid_requester CHECK (requested_by = user1_id OR requested_by = user2_id)
);

-- Create article_comments table for friend discussions
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5
CREATE TABLE IF NOT EXISTS article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tagged_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Content validation
  CONSTRAINT comment_content_length CHECK (length(trim(content)) > 0 AND length(content) <= 2000),
  -- Ensure tagged users are valid UUIDs
  CONSTRAINT comment_tagged_users_valid CHECK (
    array_length(tagged_users, 1) IS NULL OR 
    array_length(tagged_users, 1) <= 10
  )
);

-- Create user_blocks table for privacy control
-- Requirements: 2.5, 6.3, 6.4
CREATE TABLE IF NOT EXISTS user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure block uniqueness and prevent self-blocking
  CONSTRAINT block_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT block_no_self CHECK (blocker_id != blocked_id)
);

-- Create notifications table for social events
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Validation constraints
  CONSTRAINT notification_title_length CHECK (length(trim(title)) > 0),
  CONSTRAINT notification_message_length CHECK (length(trim(message)) > 0),
  CONSTRAINT notification_expiry_future CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create user_privacy_settings table for granular privacy control
-- Requirements: 6.1, 6.2, 6.3, 6.5, 8.1, 8.3
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  discoverable BOOLEAN NOT NULL DEFAULT true,
  allow_friend_requests_from privacy_level NOT NULL DEFAULT 'everyone',
  show_activity_to privacy_level NOT NULL DEFAULT 'friends',
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  push_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create performance indexes for social queries

-- Friendship lookups and status queries
CREATE INDEX IF NOT EXISTS idx_friendships_user1_status ON friendships(user1_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_user2_status ON friendships(user2_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requested_by ON friendships(requested_by);
CREATE INDEX IF NOT EXISTS idx_friendships_status_created ON friendships(status, created_at DESC);

-- Comment queries and article discussions
CREATE INDEX IF NOT EXISTS idx_article_comments_article_id ON article_comments(article_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_article_comments_user_id ON article_comments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_article_comments_created ON article_comments(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_article_comments_tagged_users ON article_comments USING GIN(tagged_users) WHERE deleted_at IS NULL;

-- Notification queries for real-time delivery
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_type_created ON notifications(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Privacy and blocking lookups
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_created ON user_blocks(created_at DESC);

-- Privacy settings lookups
CREATE INDEX IF NOT EXISTS idx_user_privacy_discoverable ON user_privacy_settings(discoverable) WHERE discoverable = true;
CREATE INDEX IF NOT EXISTS idx_user_privacy_friend_requests ON user_privacy_settings(allow_friend_requests_from);

-- Enable Row Level Security on all social tables
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for friendships table
-- Users can view friendships they are part of
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can insert friend requests they initiate
CREATE POLICY "Users can send friend requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requested_by AND (auth.uid() = user1_id OR auth.uid() = user2_id));

-- Users can update friendships they are part of (accept/decline)
CREATE POLICY "Users can update own friendships" ON friendships
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can delete friendships they are part of (unfriend)
CREATE POLICY "Users can delete own friendships" ON friendships
  FOR DELETE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Create RLS policies for article_comments table
-- Users can view comments on articles from their subscribed feeds, but only from friends
CREATE POLICY "Users can view friend comments on subscribed articles" ON article_comments
  FOR SELECT USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM articles 
      JOIN feeds ON articles.feed_id = feeds.id
      WHERE articles.id = article_comments.article_id 
      AND feeds.user_id = auth.uid()
    ) AND (
      -- User can see their own comments
      auth.uid() = user_id OR
      -- User can see comments from confirmed friends
      EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'confirmed'
        AND ((user1_id = auth.uid() AND user2_id = article_comments.user_id)
             OR (user2_id = auth.uid() AND user1_id = article_comments.user_id))
      )
    )
  );

-- Users can insert comments on articles from their subscribed feeds
CREATE POLICY "Users can comment on subscribed articles" ON article_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM articles 
      JOIN feeds ON articles.feed_id = feeds.id
      WHERE articles.id = article_comments.article_id 
      AND feeds.user_id = auth.uid()
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON article_comments
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own comments (soft delete)
CREATE POLICY "Users can delete own comments" ON article_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_blocks table
-- Users can view blocks they created
CREATE POLICY "Users can view own blocks" ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

-- Users can create blocks
CREATE POLICY "Users can create blocks" ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Users can remove their own blocks
CREATE POLICY "Users can delete own blocks" ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Create RLS policies for notifications table
-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- System can insert notifications for users
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for user_privacy_settings table
-- Users can view their own privacy settings
CREATE POLICY "Users can view own privacy settings" ON user_privacy_settings
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own privacy settings
CREATE POLICY "Users can insert own privacy settings" ON user_privacy_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own privacy settings
CREATE POLICY "Users can update own privacy settings" ON user_privacy_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_article_comments_updated_at
  BEFORE UPDATE ON article_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_privacy_settings_updated_at
  BEFORE UPDATE ON user_privacy_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle friendship confirmation timestamps
CREATE OR REPLACE FUNCTION update_friendship_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set confirmed_at when status becomes 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    NEW.confirmed_at = NOW();
  ELSIF NEW.status != 'confirmed' THEN
    NEW.confirmed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically manage friendship timestamps
CREATE TRIGGER update_friendship_timestamps_trigger
  BEFORE INSERT OR UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_friendship_timestamps();

-- Create function to automatically create privacy settings for new users
CREATE OR REPLACE FUNCTION create_default_privacy_settings()
RETURNS TRIGGER AS $$
BEGIN
  -- Create default privacy settings for new user
  INSERT INTO public.user_privacy_settings (user_id) 
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to create privacy settings when profile is created
CREATE TRIGGER create_privacy_settings_on_profile_creation
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_privacy_settings();

-- Create function to prevent blocked users from interacting
CREATE OR REPLACE FUNCTION check_user_not_blocked()
RETURNS TRIGGER AS $$
DECLARE
  is_blocked BOOLEAN := FALSE;
BEGIN
  -- Check if users are blocked in either direction for friendship operations
  IF TG_TABLE_NAME = 'friendships' THEN
    SELECT EXISTS (
      SELECT 1 FROM user_blocks 
      WHERE (blocker_id = NEW.user1_id AND blocked_id = NEW.user2_id)
         OR (blocker_id = NEW.user2_id AND blocked_id = NEW.user1_id)
    ) INTO is_blocked;
    
    IF is_blocked THEN
      RAISE EXCEPTION 'Cannot create friendship between blocked users';
    END IF;
  END IF;
  
  -- Check if comment author is blocked by article owner for comment operations
  IF TG_TABLE_NAME = 'article_comments' THEN
    SELECT EXISTS (
      SELECT 1 FROM user_blocks ub
      JOIN articles a ON a.id = NEW.article_id
      JOIN feeds f ON f.id = a.feed_id
      WHERE (ub.blocker_id = f.user_id AND ub.blocked_id = NEW.user_id)
         OR (ub.blocker_id = NEW.user_id AND ub.blocked_id = f.user_id)
    ) INTO is_blocked;
    
    IF is_blocked THEN
      RAISE EXCEPTION 'Cannot comment on articles from blocked users';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to enforce blocking constraints
CREATE TRIGGER check_friendship_not_blocked
  BEFORE INSERT OR UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION check_user_not_blocked();

CREATE TRIGGER check_comment_not_blocked
  BEFORE INSERT ON article_comments
  FOR EACH ROW EXECUTE FUNCTION check_user_not_blocked();

-- Create function to clean up friendships when users are blocked
CREATE OR REPLACE FUNCTION cleanup_friendships_on_block()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove any existing friendships between blocked users
  DELETE FROM friendships 
  WHERE (user1_id = NEW.blocker_id AND user2_id = NEW.blocked_id)
     OR (user1_id = NEW.blocked_id AND user2_id = NEW.blocker_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up friendships when blocking occurs
CREATE TRIGGER cleanup_friendships_on_block_trigger
  AFTER INSERT ON user_blocks
  FOR EACH ROW EXECUTE FUNCTION cleanup_friendships_on_block();

-- Create function to validate tagged users in comments are friends
CREATE OR REPLACE FUNCTION validate_comment_tags()
RETURNS TRIGGER AS $$
DECLARE
  tag_user_id UUID;
  is_friend BOOLEAN;
BEGIN
  -- Validate each tagged user is a confirmed friend
  IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
    FOREACH tag_user_id IN ARRAY NEW.tagged_users
    LOOP
      -- Check if tagged user is a confirmed friend
      SELECT EXISTS (
        SELECT 1 FROM friendships
        WHERE status = 'confirmed'
        AND ((user1_id = NEW.user_id AND user2_id = tag_user_id)
             OR (user2_id = NEW.user_id AND user1_id = tag_user_id))
      ) INTO is_friend;
      
      IF NOT is_friend THEN
        RAISE EXCEPTION 'Can only tag confirmed friends in comments';
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate comment tags
CREATE TRIGGER validate_comment_tags_trigger
  BEFORE INSERT OR UPDATE ON article_comments
  FOR EACH ROW EXECUTE FUNCTION validate_comment_tags();

-- Create function to automatically clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM notifications 
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create function to ensure friendship ordering (user1_id < user2_id)
CREATE OR REPLACE FUNCTION normalize_friendship_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure user1_id is always less than user2_id for consistent ordering
  IF NEW.user1_id > NEW.user2_id THEN
    -- Swap the user IDs
    NEW.user1_id := OLD.user2_id;
    NEW.user2_id := OLD.user1_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to normalize friendship ordering
CREATE TRIGGER normalize_friendship_order_trigger
  BEFORE INSERT OR UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION normalize_friendship_order();