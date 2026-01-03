import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '@shared/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * WebSocket message types
 */
export interface WebSocketMessage {
  type: 'notification' | 'comment_update' | 'friend_status_update';
  data?: any;
  userId?: string;
  timestamp?: number;
}

/**
 * WebSocket connection states
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * WebSocket context interface
 */
interface WebSocketContextType {
  connectionState: ConnectionState;
  isConnected: boolean;
  lastNotification: any;
  lastCommentUpdate: any;
  lastFriendStatusUpdate: any;
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
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastNotification, setLastNotification] = useState<any>(null);
  const [lastCommentUpdate, setLastCommentUpdate] = useState<any>(null);
  const [lastFriendStatusUpdate, setLastFriendStatusUpdate] = useState<any>(null);
  const [connectionStats, setConnectionStats] = useState({
    connectedAt: null as Date | null,
    reconnectAttempts: 0,
    lastError: null as string | null
  });

  const channelRef = useRef<RealtimeChannel | null>(null);

  const connect = () => {
    if (!user || !isSupabaseConfigured()) {
      setConnectionState('disconnected');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setConnectionState('error');
      return;
    }

    try {
      setConnectionState('connecting');
      console.log('🔌 Connecting to Supabase Realtime for user:', user.id);
      
      channelRef.current = supabase
        .channel(`user_${user.id}`)
        .on('broadcast', { event: 'notification' }, (payload) => {
          console.log('📱 Realtime notification:', payload);
          setLastNotification(payload.payload);
        })
        .on('broadcast', { event: 'comment_update' }, (payload) => {
          console.log('📝 Realtime comment update:', payload);
          setLastCommentUpdate(payload.payload);
        })
        .on('broadcast', { event: 'friend_status_update' }, (payload) => {
          console.log('👥 Realtime friend status update:', payload);
          setLastFriendStatusUpdate(payload.payload);
        })
        .subscribe((status) => {
          console.log('🔌 Supabase Realtime status:', status);
          
          if (status === 'SUBSCRIBED') {
            setConnectionState('connected');
            setConnectionStats(prev => ({
              ...prev,
              connectedAt: new Date(),
              reconnectAttempts: 0,
              lastError: null
            }));
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionState('error');
            setConnectionStats(prev => ({
              ...prev,
              lastError: 'Channel subscription failed'
            }));
          }
        });

    } catch (error) {
      console.error('🔌 Supabase Realtime connection error:', error);
      setConnectionState('error');
      setConnectionStats(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

      wsRef.current.onopen = () => {
        console.log('🔌 WebSocket connected');
        setConnectionState('connected');
        setConnectionStats(prev => ({
          ...prev,
          connectedAt: new Date(),
          reconnectAttempts: 0,
          lastError: null
        }));

        // Authenticate with user ID
        if (wsRef.current && user) {
          wsRef.current.send(JSON.stringify({
            type: 'auth',
            data: { userId: user.id }
          }));
        }

        // Start heartbeat
        startHeartbeat();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'notification':
              console.log('📱 Received notification:', message.data);
              setLastNotification(message.data);
              break;
            case 'comment_update':
              console.log('💬 Received comment update:', message.data);
              setLastCommentUpdate(message.data);
              break;
            case 'friend_status_update':
              console.log('👥 Received friend status update:', message.data);
              setLastFriendStatusUpdate(message.data);
              break;
            case 'pong':
              // Heartbeat response
              break;
            case 'error':
              console.error('🔌 WebSocket error:', message.data);
              setConnectionStats(prev => ({
                ...prev,
                lastError: message.data?.error || 'Unknown error'
              }));
              break;
          }
        } catch (error) {
          console.error('🔌 Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setConnectionState('disconnected');
        stopHeartbeat();
        
        // Attempt to reconnect if not a clean close
        if (event.code !== 1000 && user) {
          scheduleReconnect();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('🔌 WebSocket error:', error);
        setConnectionState('error');
        setConnectionStats(prev => ({
          ...prev,
          lastError: 'Connection error'
        }));
      };

    } catch (error) {
      console.error('🔌 Failed to create WebSocket connection:', error);
      setConnectionState('error');
      setConnectionStats(prev => ({
        ...prev,
        lastError: 'Failed to create connection'
      }));
    }
  };

  const disconnect = () => {
    if (channelRef.current) {
      console.log('🔌 Disconnecting from Supabase Realtime');
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnectionState('disconnected');
  };

  const reconnect = () => {
    disconnect();
    if (user) {
      connect();
    }
  };

  // Connect when user is available
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  const contextValue: WebSocketContextType = {
    connectionState,
    isConnected: connectionState === 'connected',
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