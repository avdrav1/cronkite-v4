import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './use-auth';

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
 * Notification data received from WebSocket
 */
export interface RealtimeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, any>;
  createdAt: string;
  timestamp: number;
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
 * WebSocket connection states
 */
export type WebSocketState = 'connecting' | 'connected' | 'authenticated' | 'disconnected' | 'error';

/**
 * WebSocket hook for real-time notifications
 * Requirements: 7.1, 7.2 - Client-side WebSocket connection management
 * 
 * This hook handles:
 * - WebSocket connection lifecycle
 * - User authentication over WebSocket
 * - Real-time notification reception
 * - Connection health monitoring
 * - Automatic reconnection
 */
export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  
  const [connectionState, setConnectionState] = useState<WebSocketState>('disconnected');
  const [lastNotification, setLastNotification] = useState<RealtimeNotification | null>(null);
  const [lastCommentUpdate, setLastCommentUpdate] = useState<CommentUpdateData | null>(null);
  const [lastFriendStatusUpdate, setLastFriendStatusUpdate] = useState<FriendStatusUpdateData | null>(null);
  const [connectionStats, setConnectionStats] = useState({
    connectedAt: null as Date | null,
    reconnectAttempts: 0,
    lastError: null as string | null
  });

  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds
  const heartbeatInterval = 30000; // 30 seconds

  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'notification':
          if (message.data.id) {
            // Real notification
            setLastNotification({
              id: message.data.id,
              type: message.data.type,
              title: message.data.title,
              message: message.data.message,
              data: message.data.data || {},
              createdAt: message.data.createdAt,
              timestamp: message.timestamp || Date.now()
            });
          } else {
            // System message (connection status, etc.)
            console.log('📱 WebSocket system message:', message.data.message);
            
            if (message.data.message === 'Authentication successful') {
              setConnectionState('authenticated');
              setConnectionStats(prev => ({
                ...prev,
                connectedAt: new Date(),
                reconnectAttempts: reconnectAttemptsRef.current,
                lastError: null
              }));
              reconnectAttemptsRef.current = 0;
            }
          }
          break;

        case 'comment_update':
          // Real-time comment updates
          console.log('📝 Comment update received:', message.data);
          setLastCommentUpdate(message.data);
          
          // Dispatch custom event for components to listen to
          window.dispatchEvent(new CustomEvent('commentUpdate', { 
            detail: message.data 
          }));
          break;

        case 'friend_status_update':
          // Real-time friend status updates
          console.log('👥 Friend status update received:', message.data);
          setLastFriendStatusUpdate(message.data);
          
          // Dispatch custom event for components to listen to
          window.dispatchEvent(new CustomEvent('friendStatusUpdate', { 
            detail: message.data 
          }));
          break;
          
        case 'pong':
          // Heartbeat response - connection is alive
          break;
          
        case 'error':
          console.error('📱 WebSocket error:', message.data.error);
          setConnectionStats(prev => ({
            ...prev,
            lastError: message.data.error
          }));
          break;
          
        default:
          console.warn('📱 Unknown WebSocket message type:', message.type);
      }
    } catch (error) {
      console.error('📱 Failed to parse WebSocket message:', error);
    }
  }, []);

  /**
   * Authenticate user with WebSocket server
   */
  const authenticate = useCallback(() => {
    if (user?.id && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendMessage({
        type: 'auth',
        data: { userId: user.id }
      });
    }
  }, [user?.id, sendMessage]);

  /**
   * Start heartbeat to keep connection alive
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      sendMessage({ type: 'ping', timestamp: Date.now() });
    }, heartbeatInterval);
  }, [sendMessage]);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Disable WebSocket in production (use Supabase Realtime instead)
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isProduction) {
      console.log('📱 WebSocket disabled in production - using Supabase Realtime');
      setConnectionState('disconnected');
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      setConnectionState('connecting');
      
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log('📱 Connecting to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📱 WebSocket connected');
        setConnectionState('connected');
        startHeartbeat();
        
        // Authenticate if user is logged in
        if (user?.id) {
          authenticate();
        }
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('📱 WebSocket disconnected:', event.code, event.reason);
        setConnectionState('disconnected');
        stopHeartbeat();
        
        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          console.log(`📱 Attempting reconnection ${reconnectAttemptsRef.current}/${maxReconnectAttempts}...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttemptsRef.current); // Exponential backoff
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('📱 Max reconnection attempts reached');
          setConnectionStats(prev => ({
            ...prev,
            lastError: 'Max reconnection attempts reached'
          }));
        }
      };

      ws.onerror = (error) => {
        console.error('📱 WebSocket error:', error);
        setConnectionState('error');
        setConnectionStats(prev => ({
          ...prev,
          lastError: 'Connection error'
        }));
      };

    } catch (error) {
      console.error('📱 Failed to create WebSocket connection:', error);
      setConnectionState('error');
      setConnectionStats(prev => ({
        ...prev,
        lastError: 'Failed to create connection'
      }));
    }
  }, [user?.id, authenticate, handleMessage, startHeartbeat, stopHeartbeat]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop heartbeat
    stopHeartbeat();

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setConnectionState('disconnected');
    reconnectAttemptsRef.current = 0;
  }, [stopHeartbeat]);

  /**
   * Manually trigger reconnection
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      reconnectAttemptsRef.current = 0;
      connect();
    }, 1000);
  }, [disconnect, connect]);

  // Connect when user logs in
  useEffect(() => {
    if (user?.id && connectionState === 'disconnected') {
      connect();
    } else if (!user?.id && connectionState !== 'disconnected') {
      disconnect();
    }
  }, [user?.id, connectionState, connect, disconnect]);

  // Authenticate when connection is established and user is available
  useEffect(() => {
    if (connectionState === 'connected' && user?.id) {
      authenticate();
    }
  }, [connectionState, user?.id, authenticate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    lastNotification,
    lastCommentUpdate,
    lastFriendStatusUpdate,
    connectionStats,
    isConnected: connectionState === 'authenticated',
    connect,
    disconnect,
    reconnect,
    sendMessage
  };
}