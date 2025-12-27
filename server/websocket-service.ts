import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import { log, logError, logSuccess } from './app-setup';
import { notificationService, type NotificationWithData } from './notification-service';

/**
 * WebSocket connection with user authentication
 */
interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

/**
 * WebSocket message types for client-server communication
 */
export interface WebSocketMessage {
  type: 'auth' | 'notification' | 'ping' | 'pong' | 'error' | 'comment_update' | 'friend_status_update';
  data?: any;
  userId?: string;
  timestamp?: number;
}

/**
 * Comment update data for real-time comment synchronization
 */
export interface CommentUpdateData {
  articleId: string;
  comment: {
    id: string;
    content: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    createdAt: string;
    taggedUsers: string[];
  };
  action: 'added' | 'deleted';
}

/**
 * Friend status update data for real-time friend activity
 */
export interface FriendStatusUpdateData {
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  status: 'online' | 'offline' | 'friend_request_sent' | 'friend_request_accepted' | 'unfriended';
  timestamp: number;
}

/**
 * WebSocket Service for Real-time Notifications
 * Requirements: 7.1, 7.2, 4.2 - Real-time notification delivery
 * 
 * This service handles:
 * - WebSocket server setup for notification delivery
 * - Client connection management and authentication
 * - Real-time friend request and comment notifications
 * - Connection health monitoring and cleanup
 */
export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, Set<AuthenticatedWebSocket>>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize WebSocket server
   * Requirements: 7.1 - WebSocket server setup for notification delivery
   * 
   * @param server - HTTP server instance
   * @returns Promise<void>
   */
  async initialize(server: Server): Promise<void> {
    try {
      // Create WebSocket server
      this.wss = new WebSocketServer({
        server,
        path: '/ws',
        verifyClient: (info: any) => {
          // Basic verification - could add more sophisticated auth here
          const url = parse(info.req.url || '', true);
          return true; // Allow all connections for now, auth happens after connection
        }
      });

      // Handle new connections
      this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
        this.handleConnection(ws, request);
      });

      // Start heartbeat to keep connections alive
      this.startHeartbeat();

      logSuccess('✅ WebSocket server initialized on /ws');
    } catch (error) {
      logError('Failed to initialize WebSocket server', error as Error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   * Requirements: 7.2 - Client-side WebSocket connection management
   * 
   * @param ws - WebSocket connection
   * @param request - HTTP request
   * @private
   */
  private handleConnection(ws: AuthenticatedWebSocket, request: any): void {
    ws.isAlive = true;
    
    log(`🔌 New WebSocket connection from ${request.socket.remoteAddress}`);

    // Handle incoming messages
    ws.on('message', (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        logError('Failed to parse WebSocket message', error as Error);
        this.sendError(ws, 'Invalid message format');
      }
    });

    // Handle connection close
    ws.on('close', (code: number, reason: Buffer) => {
      log(`🔌 WebSocket connection closed: ${code} ${reason.toString()}`);
      this.removeConnection(ws);
    });

    // Handle connection errors
    ws.on('error', (error: Error) => {
      logError('WebSocket connection error', error);
      this.removeConnection(ws);
    });

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'notification',
      data: {
        message: 'Connected to Cronkite real-time notifications',
        timestamp: Date.now()
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   * Requirements: 7.2 - Message handling for authentication and communication
   * 
   * @param ws - WebSocket connection
   * @param message - Parsed message
   * @private
   */
  private handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    switch (message.type) {
      case 'auth':
        this.handleAuthentication(ws, message);
        break;
      
      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;
      
      default:
        logError(`Unknown WebSocket message type: ${message.type}`);
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle user authentication
   * Requirements: 7.2 - Authenticate WebSocket connections
   * 
   * @param ws - WebSocket connection
   * @param message - Authentication message
   * @private
   */
  private handleAuthentication(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    const { userId } = message.data || {};
    
    if (!userId) {
      this.sendError(ws, 'User ID required for authentication');
      return;
    }

    // TODO: Validate user session/token here
    // For now, we'll trust the client-provided userId
    // In production, this should verify the user's session or JWT token
    
    ws.userId = userId;
    
    // Add to user connections
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(ws);

    log(`👤 User ${userId} authenticated on WebSocket`);
    
    // Send authentication success
    this.sendMessage(ws, {
      type: 'notification',
      data: {
        message: 'Authentication successful',
        userId,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Send real-time notification to user
   * Requirements: 7.1, 7.2 - Real-time friend request and comment notifications
   * 
   * @param userId - ID of user to notify
   * @param notification - Notification data
   * @returns Promise<boolean> - True if notification was sent to at least one connection
   */
  async sendNotificationToUser(userId: string, notification: NotificationWithData): Promise<boolean> {
    const userConnections = this.connections.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      log(`📱 No active WebSocket connections for user ${userId}`);
      return false;
    }

    const message: WebSocketMessage = {
      type: 'notification',
      data: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt,
        timestamp: Date.now()
      },
      userId
    };

    // Send to all user connections
    let sentCount = 0;
    const deadConnections: AuthenticatedWebSocket[] = [];

    // Send to all user connections
    userConnections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          this.sendMessage(ws, message);
          sentCount++;
        } catch (error) {
          logError(`Failed to send notification to user ${userId}`, error as Error);
          deadConnections.push(ws);
        }
      } else {
        deadConnections.push(ws);
      }
    });

    // Clean up dead connections
    deadConnections.forEach(ws => {
      userConnections.delete(ws);
    });

    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }

    if (sentCount > 0) {
      log(`📱 Sent real-time notification to ${sentCount} connections for user ${userId}`);
    }

    return sentCount > 0;
  }

  /**
   * Broadcast notification to multiple users
   * Requirements: 7.1 - Efficient notification delivery
   * 
   * @param userIds - Array of user IDs to notify
   * @param notification - Notification data
   * @returns Promise<number> - Number of users who received the notification
   */
  async broadcastNotification(userIds: string[], notification: NotificationWithData): Promise<number> {
    let deliveredCount = 0;
    
    for (const userId of userIds) {
      const delivered = await this.sendNotificationToUser(userId, notification);
      if (delivered) {
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  /**
   * Send real-time comment update to users viewing an article
   * Requirements: 3.1 - Live comment updates on articles
   * 
   * @param articleId - ID of the article
   * @param commentUpdate - Comment update data
   * @param excludeUserId - User ID to exclude from broadcast (e.g., the comment author)
   * @returns Promise<number> - Number of users who received the update
   */
  async sendCommentUpdate(articleId: string, commentUpdate: CommentUpdateData, excludeUserId?: string): Promise<number> {
    // Find all users who might be viewing this article
    // For now, we'll broadcast to all connected users except the author
    // In a more sophisticated implementation, we could track which users are viewing which articles
    
    const message: WebSocketMessage = {
      type: 'comment_update',
      data: commentUpdate,
      timestamp: Date.now()
    };

    let deliveredCount = 0;

    Array.from(this.connections.entries()).forEach(([userId, userConnections]) => {
      // Skip the user who made the comment to avoid echo
      if (excludeUserId && userId === excludeUserId) {
        return;
      }

      // Send to all connections for this user
      const deadConnections: AuthenticatedWebSocket[] = [];
      
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            this.sendMessage(ws, message);
            deliveredCount++;
          } catch (error) {
            logError(`Failed to send comment update to user ${userId}`, error as Error);
            deadConnections.push(ws);
          }
        } else {
          deadConnections.push(ws);
        }
      });

      // Clean up dead connections
      deadConnections.forEach(ws => {
        userConnections.delete(ws);
      });

      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    });

    if (deliveredCount > 0) {
      log(`📝 Sent comment update for article ${articleId} to ${deliveredCount} connections`);
    }

    return deliveredCount;
  }

  /**
   * Send real-time friend status update to a user's friends
   * Requirements: 2.2 - Live friend status updates
   * 
   * @param userId - ID of the user whose status changed
   * @param friendIds - Array of friend IDs to notify
   * @param statusUpdate - Friend status update data
   * @returns Promise<number> - Number of friends who received the update
   */
  async sendFriendStatusUpdate(userId: string, friendIds: string[], statusUpdate: FriendStatusUpdateData): Promise<number> {
    const message: WebSocketMessage = {
      type: 'friend_status_update',
      data: statusUpdate,
      userId,
      timestamp: Date.now()
    };

    let deliveredCount = 0;

    for (const friendId of friendIds) {
      const friendConnections = this.connections.get(friendId);
      
      if (friendConnections && friendConnections.size > 0) {
        const deadConnections: AuthenticatedWebSocket[] = [];
        
        friendConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              this.sendMessage(ws, message);
              deliveredCount++;
            } catch (error) {
              logError(`Failed to send friend status update to user ${friendId}`, error as Error);
              deadConnections.push(ws);
            }
          } else {
            deadConnections.push(ws);
          }
        });

        // Clean up dead connections
        deadConnections.forEach(ws => {
          friendConnections.delete(ws);
        });

        if (friendConnections.size === 0) {
          this.connections.delete(friendId);
        }
      }
    }

    if (deliveredCount > 0) {
      log(`👥 Sent friend status update from user ${userId} to ${deliveredCount} connections`);
    }

    return deliveredCount;
  }

  /**
   * Send real-time tagging notification
   * Requirements: 4.3 - Real-time tagging notifications
   * 
   * @param taggedUserId - ID of the user who was tagged
   * @param taggerUserId - ID of the user who did the tagging
   * @param tagData - Tagging notification data
   * @returns Promise<boolean> - True if notification was delivered
   */
  async sendTagNotification(taggedUserId: string, taggerUserId: string, tagData: any): Promise<boolean> {
    const message: WebSocketMessage = {
      type: 'notification',
      data: {
        type: 'tag',
        taggerUserId,
        ...tagData
      },
      userId: taggedUserId,
      timestamp: Date.now()
    };

    return await this.sendNotificationToUser(taggedUserId, {
      id: `tag-${Date.now()}`,
      userId: taggedUserId,
      type: 'comment_tag',
      title: 'You were tagged',
      message: `${tagData.taggerName} tagged you in a comment`,
      data: tagData,
      createdAt: new Date()
    });
  }

  /**
   * Get connection statistics
   * Requirements: 7.1 - Monitor WebSocket service health
   * 
   * @returns Object with connection statistics
   */
  getConnectionStats(): { totalConnections: number; authenticatedUsers: number; averageConnectionsPerUser: number } {
    let totalConnections = 0;
    
    Array.from(this.connections.values()).forEach(userConnections => {
      totalConnections += userConnections.size;
    });

    const authenticatedUsers = this.connections.size;
    const averageConnectionsPerUser = authenticatedUsers > 0 ? totalConnections / authenticatedUsers : 0;

    return {
      totalConnections,
      authenticatedUsers,
      averageConnectionsPerUser: Math.round(averageConnectionsPerUser * 100) / 100
    };
  }

  /**
   * Send message to WebSocket connection
   * @private
   */
  private sendMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to WebSocket connection
   * @private
   */
  private sendError(ws: AuthenticatedWebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { error, timestamp: Date.now() }
    });
  }

  /**
   * Remove connection from tracking
   * @private
   */
  private removeConnection(ws: AuthenticatedWebSocket): void {
    if (ws.userId) {
      const userConnections = this.connections.get(ws.userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          this.connections.delete(ws.userId);
        }
      }
    }
  }

  /**
   * Start heartbeat to keep connections alive
   * @private
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          log('🔌 Terminating dead WebSocket connection');
          this.removeConnection(ws);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  /**
   * Shutdown WebSocket service
   * Requirements: 7.1 - Graceful shutdown
   * 
   * @returns Promise<void>
   */
  async shutdown(): Promise<void> {
    log('🔌 Shutting down WebSocket service...');

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close all connections
    if (this.wss) {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        this.sendMessage(ws, {
          type: 'notification',
          data: { message: 'Server shutting down', timestamp: Date.now() }
        });
        ws.close(1001, 'Server shutdown');
      });

      // Close server
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          logSuccess('✅ WebSocket server closed');
          resolve();
        });
      });
    }

    // Clear connections
    this.connections.clear();
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();