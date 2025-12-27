import { describe, it, expect, beforeEach, vi } from 'vitest';
import { commentService } from '../server/comment-service';

// Mock the dependencies
vi.mock('../server/production-db', () => ({
  getDatabase: vi.fn(() => ({
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{
          id: 'comment-1',
          article_id: 'article-1',
          user_id: 'user-1',
          content: 'This is a test comment',
          tagged_users: [],
          created_at: new Date(),
          updated_at: new Date()
        }]))
      }))
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([{
            id: 'user-1',
            email: 'test@example.com',
            display_name: 'Test User',
            avatar_url: null,
            timezone: 'UTC',
            region_code: null,
            onboarding_completed: false,
            is_admin: false,
            created_at: new Date(),
            updated_at: new Date()
          }]))
        }))
      }))
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve())
      }))
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve())
    }))
  }))
}));

vi.mock('../server/privacy-service', () => ({
  privacyService: {
    canComment: vi.fn(() => Promise.resolve(true)),
    canTagUser: vi.fn(() => Promise.resolve(true))
  }
}));

vi.mock('../server/friend-service', () => ({
  friendService: {
    areUsersFriends: vi.fn(() => Promise.resolve(true)),
    getFriends: vi.fn(() => Promise.resolve([
      {
        id: 'friend-1',
        profile: {
          id: 'friend-1',
          email: 'friend@example.com',
          display_name: 'Friend User',
          avatar_url: null,
          timezone: 'UTC',
          region_code: null,
          onboarding_completed: false,
          is_admin: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        friendshipId: 'friendship-1',
        confirmedAt: new Date()
      }
    ]))
  }
}));

describe('CommentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMentions', () => {
    it('should parse @username mentions from content', () => {
      const content = 'Hello @john and @jane_doe, check this out!';
      const mentions = commentService.parseMentions(content);
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        username: 'john',
        startIndex: 6,
        endIndex: 11
      });
      expect(mentions[1]).toEqual({
        username: 'jane_doe',
        startIndex: 16,
        endIndex: 25
      });
    });

    it('should handle content with no mentions', () => {
      const content = 'This is a regular comment without mentions';
      const mentions = commentService.parseMentions(content);
      
      expect(mentions).toHaveLength(0);
    });

    it('should handle multiple mentions of the same user', () => {
      const content = 'Hey @john, @john are you there?';
      const mentions = commentService.parseMentions(content);
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0].username).toBe('john');
      expect(mentions[1].username).toBe('john');
    });

    it('should handle usernames with special characters', () => {
      const content = 'Hello @user.name and @user-123 and @user_test';
      const mentions = commentService.parseMentions(content);
      
      expect(mentions).toHaveLength(3);
      expect(mentions[0].username).toBe('user.name');
      expect(mentions[1].username).toBe('user-123');
      expect(mentions[2].username).toBe('user_test');
    });
  });

  describe('addComment', () => {
    it('should create a comment successfully', async () => {
      const input = {
        articleId: 'article-1',
        userId: 'user-1',
        content: 'This is a test comment',
        taggedUserIds: []
      };

      const result = await commentService.addComment(input);

      expect(result).toEqual({
        id: 'comment-1',
        articleId: 'article-1',
        content: 'This is a test comment',
        author: expect.objectContaining({
          id: 'user-1',
          display_name: 'Test User'
        }),
        taggedUsers: [],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });
    });

    it('should reject empty content', async () => {
      const input = {
        articleId: 'article-1',
        userId: 'user-1',
        content: '   ',
        taggedUserIds: []
      };

      await expect(commentService.addComment(input)).rejects.toThrow('Comment content cannot be empty');
    });

    it('should reject content that is too long', async () => {
      const input = {
        articleId: 'article-1',
        userId: 'user-1',
        content: 'a'.repeat(2001),
        taggedUserIds: []
      };

      await expect(commentService.addComment(input)).rejects.toThrow('Comment content cannot exceed 2000 characters');
    });

    it('should reject too many tagged users', async () => {
      const input = {
        articleId: 'article-1',
        userId: 'user-1',
        content: 'Test comment',
        taggedUserIds: Array(11).fill('user-id')
      };

      await expect(commentService.addComment(input)).rejects.toThrow('Cannot tag more than 10 users in a single comment');
    });
  });

  describe('getTagSuggestions', () => {
    it('should return friend suggestions based on query', async () => {
      const suggestions = await commentService.getTagSuggestions('friend', 'user-1', 10);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        userId: 'friend-1',
        username: 'Friend User',
        displayName: 'Friend User',
        avatarUrl: undefined
      });
    });

    it('should return empty array for short query', async () => {
      const suggestions = await commentService.getTagSuggestions('', 'user-1', 10);

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('validateTaggedUsernames', () => {
    it('should validate that all mentions are valid friends', async () => {
      const content = 'Hello @Friend User, how are you?';
      const result = await commentService.validateTaggedUsernames(content, 'user-1');

      expect(result.isValid).toBe(true);
      expect(result.invalidMentions).toHaveLength(0);
    });
  });
});