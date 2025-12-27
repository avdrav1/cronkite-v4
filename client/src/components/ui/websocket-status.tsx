import React from 'react';
import { Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * WebSocket Status Indicator Component
 * Requirements: 7.1 - Display WebSocket connection status to users
 * 
 * Shows the current WebSocket connection state with appropriate icons and colors
 */
export function WebSocketStatus({ className }: { className?: string }) {
  const { connectionState, isConnected, connectionStats, reconnect } = useWebSocketContext();

  const getStatusInfo = () => {
    switch (connectionState) {
      case 'connecting':
        return {
          icon: Wifi,
          color: 'text-yellow-500',
          label: 'Connecting...',
          description: 'Establishing real-time connection'
        };
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-blue-500',
          label: 'Connected',
          description: 'Authenticating...'
        };
      case 'authenticated':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          label: 'Live',
          description: 'Real-time notifications active'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          label: 'Error',
          description: connectionStats.lastError || 'Connection error'
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-500',
          label: 'Offline',
          description: 'Real-time notifications unavailable'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('flex items-center gap-2', className)}>
          <Icon className={cn('h-4 w-4', statusInfo.color)} />
          <span className={cn('text-sm font-medium', statusInfo.color)}>
            {statusInfo.label}
          </span>
          {connectionState === 'error' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reconnect}
              className="h-6 px-2 text-xs"
            >
              Retry
            </Button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{statusInfo.description}</p>
          {connectionStats.connectedAt && (
            <p className="text-xs text-muted-foreground">
              Connected: {connectionStats.connectedAt.toLocaleTimeString()}
            </p>
          )}
          {connectionStats.reconnectAttempts > 0 && (
            <p className="text-xs text-muted-foreground">
              Reconnect attempts: {connectionStats.reconnectAttempts}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Compact WebSocket Status Icon
 * Requirements: 7.1 - Minimal status indicator for space-constrained areas
 */
export function WebSocketStatusIcon({ className }: { className?: string }) {
  const { connectionState, reconnect } = useWebSocketContext();

  const getStatusInfo = () => {
    switch (connectionState) {
      case 'connecting':
        return {
          icon: Wifi,
          color: 'text-yellow-500',
          label: 'Connecting to real-time notifications'
        };
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-blue-500',
          label: 'Authenticating real-time connection'
        };
      case 'authenticated':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          label: 'Real-time notifications active'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          label: 'Real-time connection error - click to retry'
        };
      case 'disconnected':
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-500',
          label: 'Real-time notifications offline'
        };
    }
  };

  const statusInfo = getStatusInfo();
  const Icon = statusInfo.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={connectionState === 'error' ? reconnect : undefined}
          className={cn(
            'p-1 rounded-md transition-colors',
            connectionState === 'error' ? 'hover:bg-red-50 cursor-pointer' : 'cursor-default',
            className
          )}
        >
          <Icon className={cn('h-4 w-4', statusInfo.color)} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{statusInfo.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}