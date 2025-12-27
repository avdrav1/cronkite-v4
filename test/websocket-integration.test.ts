import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketService } from '../server/websocket-service';
import { createServer } from 'http';
import WebSocket from 'ws';

/**
 * WebSocket Integration Tests
 * Requirements: 7.1, 7.2, 4.2 - Test WebSocket functionality for real-time notifications
 */
describe('WebSocket Integration', () => {
  let webSocketService: WebSocketService;
  let httpServer: any;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server for testing
    httpServer = createServer();
    webSocketService = new WebSocketService();
    
    // Find available port
    port = 3001;
    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        resolve();
      });
    });

    // Initialize WebSocket service
    await webSocketService.initialize(httpServer);
  });

  afterEach(async () => {
    // Cleanup
    await webSocketService.shutdown();
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
  });

  it('should accept WebSocket connections', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        resolve();
      });
      ws.on('error', reject);
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });

  it('should handle user authentication', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        // Send authentication message
        ws.send(JSON.stringify({
          type: 'auth',
          data: { userId: 'test-user-123' }
        }));
      });

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'notification' && message.data.message === 'Authentication successful') {
          resolve();
        }
      });

      ws.on('error', reject);
    });

    ws.close();
  });

  it('should track connection statistics', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;
    const ws1 = new WebSocket(wsUrl);
    const ws2 = new WebSocket(wsUrl);

    // Wait for connections to establish
    await Promise.all([
      new Promise<void>((resolve) => ws1.on('open', resolve)),
      new Promise<void>((resolve) => ws2.on('open', resolve))
    ]);

    // Authenticate both connections
    ws1.send(JSON.stringify({ type: 'auth', data: { userId: 'user1' } }));
    ws2.send(JSON.stringify({ type: 'auth', data: { userId: 'user2' } }));

    // Wait a bit for authentication to process
    await new Promise(resolve => setTimeout(resolve, 100));

    const stats = webSocketService.getConnectionStats();
    expect(stats.totalConnections).toBe(2);
    expect(stats.authenticatedUsers).toBe(2);

    ws1.close();
    ws2.close();
  });

  it('should send notifications to authenticated users', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { userId: 'test-user-123' }
        }));
        resolve();
      });
    });

    // Wait for authentication
    await new Promise(resolve => setTimeout(resolve, 100));

    // Send notification
    const testNotification = {
      id: 'test-notification-1',
      userId: 'test-user-123',
      type: 'friend_request',
      title: 'Test Notification',
      message: 'This is a test notification',
      data: { test: true },
      createdAt: new Date()
    };

    const delivered = await webSocketService.sendNotificationToUser('test-user-123', testNotification);
    expect(delivered).toBe(true);

    ws.close();
  });

  it('should handle comment updates', async () => {
    const wsUrl = `ws://localhost:${port}/ws`;
    const ws = new WebSocket(wsUrl);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'auth',
          data: { userId: 'test-user-123' }
        }));
        resolve();
      });
    });

    // Wait for authentication
    await new Promise(resolve => setTimeout(resolve, 100));

    let receivedCommentUpdate = false;
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'comment_update') {
        receivedCommentUpdate = true;
      }
    });

    // Send comment update
    const commentUpdate = {
      articleId: 'test-article-1',
      comment: {
        id: 'test-comment-1',
        content: 'Test comment',
        userId: 'other-user',
        userName: 'Other User',
        createdAt: new Date().toISOString(),
        taggedUsers: []
      },
      action: 'added' as const
    };

    const delivered = await webSocketService.sendCommentUpdate('test-article-1', commentUpdate);
    expect(delivered).toBeGreaterThan(0);

    // Wait for message to be received
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(receivedCommentUpdate).toBe(true);

    ws.close();
  });
});