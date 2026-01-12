import { useEffect, useRef, useCallback } from 'react';
import { websocketService } from '../services/websocket';
import type { WebSocketEvent, WebSocketEventData, WebSocketChannel } from '../services/websocket';
import { useAuth } from './useAuth';

export interface UseWebSocketOptions {
  channels?: WebSocketChannel[];
  events?: WebSocketEvent[];
  onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { isAuthenticated } = useAuth();
  const {
    channels = [],
    events = [],
    onEvent,
    autoConnect = true,
  } = options;

  const unsubscribeCallbacksRef = useRef<Array<() => void>>([]);
  const subscribedChannelsRef = useRef<Set<WebSocketChannel>>(new Set());

  // Connect on mount if authenticated
  useEffect(() => {
    if (!autoConnect || !isAuthenticated) {
      return;
    }

    const connect = async () => {
      try {
        await websocketService.connect();
      } catch (error) {
        console.error('WebSocket connection failed:', error);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      // Unsubscribe from all channels
      subscribedChannelsRef.current.forEach((channel) => {
        websocketService.unsubscribeFromChannel(channel);
      });
      subscribedChannelsRef.current.clear();

      // Unsubscribe from all events
      unsubscribeCallbacksRef.current.forEach((unsubscribe) => {
        unsubscribe();
      });
      unsubscribeCallbacksRef.current = [];
    };
  }, [isAuthenticated, autoConnect]);

  // Subscribe to channels
  useEffect(() => {
    if (!isAuthenticated || !websocketService.isConnected() || channels.length === 0) {
      return;
    }

    const subscribeToChannels = async () => {
      for (const channel of channels) {
        if (subscribedChannelsRef.current.has(channel)) {
          continue; // Already subscribed
        }

        try {
          await websocketService.subscribeToChannel(channel);
          subscribedChannelsRef.current.add(channel);
        } catch (error) {
          console.error(`Failed to subscribe to channel ${channel}:`, error);
        }
      }
    };

    subscribeToChannels();

    // Cleanup: unsubscribe from channels that are no longer in the list
    const currentChannels = new Set(channels);
    subscribedChannelsRef.current.forEach((channel) => {
      if (!currentChannels.has(channel)) {
        websocketService.unsubscribeFromChannel(channel);
        subscribedChannelsRef.current.delete(channel);
      }
    });
  }, [isAuthenticated, channels]);

  // Subscribe to events
  useEffect(() => {
    if (events.length === 0 || !onEvent) {
      return;
    }

    // Subscribe to each event
    events.forEach((event) => {
      const unsubscribe = websocketService.on(event, (data) => {
        onEvent(event, data);
      });
      unsubscribeCallbacksRef.current.push(unsubscribe);
    });

    // Cleanup
    return () => {
      // Remove all callbacks for events
      unsubscribeCallbacksRef.current.forEach((unsubscribe) => {
        unsubscribe();
      });
      unsubscribeCallbacksRef.current = [];
    };
  }, [events, onEvent]);

  // Manual subscribe function
  const subscribe = useCallback(async (channel: WebSocketChannel) => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      await websocketService.subscribeToChannel(channel);
      subscribedChannelsRef.current.add(channel);
    } catch (error) {
      console.error(`Failed to subscribe to channel ${channel}:`, error);
      throw error;
    }
  }, [isAuthenticated]);

  // Manual unsubscribe function
  const unsubscribe = useCallback((channel: WebSocketChannel) => {
    websocketService.unsubscribeFromChannel(channel);
    subscribedChannelsRef.current.delete(channel);
  }, []);

  // Manual connect function
  const connect = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }
    return await websocketService.connect();
  }, [isAuthenticated]);

  // Manual disconnect function
  const disconnect = useCallback(() => {
    websocketService.disconnect();
    subscribedChannelsRef.current.clear();
    unsubscribeCallbacksRef.current.forEach((unsubscribe) => {
      unsubscribe();
    });
    unsubscribeCallbacksRef.current = [];
  }, []);

  return {
    isConnected: websocketService.isConnected(),
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    socket: websocketService.getSocket(),
  };
}

/**
 * Hook for subscribing to shipment events
 */
export function useShipmentWebSocket(trackingNumber: string | null, onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void) {
  const channels: WebSocketChannel[] = trackingNumber ? [`shipment:${trackingNumber}`] : [];
  const events: WebSocketEvent[] = ['shipment.scan.created', 'shipment.status.updated'];

  return useWebSocket({
    channels,
    events,
    onEvent,
    autoConnect: !!trackingNumber,
  });
}

/**
 * Hook for subscribing to route events
 */
export function useRouteWebSocket(routeCode: string | null, onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void) {
  const channels: WebSocketChannel[] = routeCode ? [`routes:${routeCode}`] : [];
  
  return useWebSocket({
    channels,
    onEvent,
    autoConnect: !!routeCode,
  });
}

/**
 * Hook for subscribing to issues events (admin/dispatcher only)
 */
export function useIssuesWebSocket(onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void) {
  const channels: WebSocketChannel[] = ['issues'];
  const events: WebSocketEvent[] = ['issue.created', 'issue.updated'];

  return useWebSocket({
    channels,
    events,
    onEvent,
  });
}

/**
 * Hook for subscribing to delivery change requests events
 */
export function useDeliveryChangesWebSocket(onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void) {
  const channels: WebSocketChannel[] = ['delivery-changes'];
  const events: WebSocketEvent[] = ['delivery_change_request.created', 'delivery_change_request.updated'];

  return useWebSocket({
    channels,
    events,
    onEvent,
  });
}

/**
 * Hook for subscribing to escalations events (manager/admin only)
 */
export function useEscalationsWebSocket(onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void) {
  const channels: WebSocketChannel[] = ['escalations'];
  const events: WebSocketEvent[] = ['escalation.triggered', 'escalation.advanced', 'escalation.acknowledged'];

  return useWebSocket({
    channels,
    events,
    onEvent,
  });
}

/**
 * Hook for subscribing to metrics events (admin/dispatcher only)
 */
export function useMetricsWebSocket(onEvent?: (event: WebSocketEvent, data: WebSocketEventData) => void) {
  const channels: WebSocketChannel[] = ['metrics:overview'];
  const events: WebSocketEvent[] = ['metrics.snapshot.created'];

  return useWebSocket({
    channels,
    events,
    onEvent,
  });
}
