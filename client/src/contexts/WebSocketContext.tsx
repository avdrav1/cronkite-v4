import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWebSocket, type RealtimeNotification, type WebSocketState, type CommentUpdateData, type FriendStatusUpdateData } from '@/hooks/use-websocket';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

/**
 * WebSocket context interface
 */
interface WebSocketContextType {
  connectionState: WebSocketState;
  isConnected: boolean;
  lastNotification: RealtimeNotification | null;
  lastCommentUpdate: CommentUpdateData | null;
  lastFriendStatusUpdate: FriendStatusUpdateData | null;
  connectionStats: {
    connectedAt: Date | null;
    reconnectAttempts: number;
    lastError: string | null;
  };
  reconnect: () => void;
}

/**
 * WebSocket context
 */
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

/**
 * WebSocket Provider Component
 * Requirements: 7.1, 7.2 - Global WebSocket connection management
 * 
 * This provider:
 * - Manages global WebSocket connection
 * - Handles real-time notification display
 * - Provides connection status to all components
 * - Shows toast notifications for real-time events
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const {
    connectionState,
    lastNotification,
    lastCommentUpdate,
    lastFriendStatusUpdate,
    connectionStats,
    isConnected,
    reconnect
  } = useWebSocket();

  const [processedNotifications, setProcessedNotifications] = useState<Set<string>>(new Set());

  // Handle new notifications
  useEffect(() => {
    if (lastNotification && !processedNotifications.has(lastNotification.id)) {
      // Mark as processed
      setProcessedNotifications(prev => new Set(prev).add(lastNotification.id));

      // Show toast notification
      showNotificationToast(lastNotification);

      // Trigger browser notification if permission granted
      showBrowserNotification(lastNotification);
    }
  }, [lastNotification, processedNotifications]);

  // Handle new friend status updates
  useEffect(() => {
    if (lastFriendStatusUpdate) {
      showFriendStatusToast(lastFriendStatusUpdate);
    }
  }, [lastFriendStatusUpdate]);

  // Handle new comment updates
  useEffect(() => {
    if (lastCommentUpdate) {
      showCommentUpdateToast(lastCommentUpdate);
    }
  }, [lastCommentUpdate]);

  /**
   * Show toast notification for friend status updates
   */
  const showFriendStatusToast = (statusUpdate: FriendStatusUpdateData) => {
    const { friendName, status } = statusUpdate;

    switch (status) {
      case 'friend_request_accepted':
        toast.success('Friend Request Accepted', {
          description: `${friendName} accepted your friend request`,
          duration: 4000
        });
        break;

      case 'unfriended':
        toast.info('Friendship Ended', {
          description: `${friendName} is no longer your friend`,
          duration: 4000
        });
        break;

      case 'online':
        toast.info('Friend Online', {
          description: `${friendName} is now online`,
          duration: 2000
        });
        break;

      case 'offline':
        // Don't show toast for offline status to avoid spam
        break;

      default:
        console.log('Friend status update:', statusUpdate);
    }
  };

  /**
   * Show toast notification for comment updates
   */
  const showCommentUpdateToast = (commentUpdate: CommentUpdateData) => {
    const { comment, action, articleId } = commentUpdate;

    // Only show toast if user is not the comment author (to avoid self-notifications)
    if (comment.userId === user?.id) {
      return;
    }

    switch (action) {
      case 'added':
        toast.info('New Comment', {
          description: `${comment.userName} commented on an article`,
          action: {
            label: 'View',
            onClick: () => {
              window.location.href = `/?article=${articleId}`;
            }
          },
          duration: 4000
        });
        break;

      case 'deleted':
        // Don't show toast for deletions to avoid spam
        break;

      default:
        console.log('Comment update:', commentUpdate);
    }
  };

  /**
   * Show toast notification for real-time events
   */
  const showNotificationToast = (notification: RealtimeNotification) => {
    const { type, title, message, data } = notification;

    switch (type) {
      case 'friend_request':
        toast.success(title, {
          description: message,
          action: {
            label: 'View',
            onClick: () => {
              // Navigate to friend requests
              window.location.href = '/settings?tab=friends';
            }
          },
          duration: 5000
        });
        break;

      case 'friend_accepted':
        toast.success(title, {
          description: message,
          duration: 4000
        });
        break;

      case 'comment_tag':
        toast.info(title, {
          description: message,
          action: {
            label: 'View Article',
            onClick: () => {
              // Navigate to article
              if (data.articleId) {
                window.location.href = `/?article=${data.articleId}`;
              }
            }
          },
          duration: 6000
        });
        break;

      case 'comment_reply':
        toast.info(title, {
          description: message,
          action: {
            label: 'View Reply',
            onClick: () => {
              // Navigate to article
              if (data.articleId) {
                window.location.href = `/?article=${data.articleId}`;
              }
            }
          },
          duration: 6000
        });
        break;

      default:
        toast.info(title, {
          description: message,
          duration: 4000
        });
    }
  };

  /**
   * Show browser notification if permission granted
   */
  const showBrowserNotification = (notification: RealtimeNotification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotification = new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.png',
          tag: notification.id, // Prevent duplicate notifications
          requireInteraction: false
        });

        // Auto-close after 5 seconds
        setTimeout(() => {
          browserNotification.close();
        }, 5000);

        // Handle click
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
          
          // Navigate based on notification type
          const { type, data } = notification;
          if (type === 'friend_request') {
            window.location.href = '/settings?tab=friends';
          } else if ((type === 'comment_tag' || type === 'comment_reply') && data.articleId) {
            window.location.href = `/?article=${data.articleId}`;
          }
        };
      } catch (error) {
        console.error('Failed to show browser notification:', error);
      }
    }
  };

  // Request notification permission when user logs in
  useEffect(() => {
    if (user && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('📱 Browser notifications enabled');
        }
      });
    }
  }, [user]);

  const contextValue: WebSocketContextType = {
    connectionState,
    isConnected,
    lastNotification,
    lastCommentUpdate,
    lastFriendStatusUpdate,
    connectionStats,
    reconnect
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to use WebSocket context
 * Requirements: 7.1 - Access WebSocket connection status and notifications
 */
export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}