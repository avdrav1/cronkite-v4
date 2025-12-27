import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Temporarily disable WebSocket to fix loading issues
// TODO: Re-enable once WebSocket server is properly configured

/**
 * WebSocket context interface
 */
interface WebSocketContextType {
  connectionState: 'disconnected';
  isConnected: false;
  lastNotification: null;
  lastCommentUpdate: null;
  lastFriendStatusUpdate: null;
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
 * WebSocket Provider Component - TEMPORARILY DISABLED
 * Requirements: 7.1, 7.2 - Global WebSocket connection management
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Temporarily disabled WebSocket functionality
  const contextValue: WebSocketContextType = {
    connectionState: 'disconnected',
    isConnected: false,
    lastNotification: null,
    lastCommentUpdate: null,
    lastFriendStatusUpdate: null,
    connectionStats: {
      connectedAt: null,
      reconnectAttempts: 0,
      lastError: 'WebSocket temporarily disabled'
    },
    reconnect: () => {
      console.log('WebSocket reconnect called - currently disabled');
    }
  };

  // Log that WebSocket is disabled
  useEffect(() => {
    if (user) {
      console.log('🔌 WebSocket service temporarily disabled - real-time features unavailable');
    }
  }, [user]);

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