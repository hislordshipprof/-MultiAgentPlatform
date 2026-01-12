import { io, Socket } from 'socket.io-client';
import { authApi } from './api';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';

export type WebSocketEvent = 
  | 'shipment.scan.created'
  | 'shipment.status.updated'
  | 'issue.created'
  | 'issue.updated'
  | 'escalation.triggered'
  | 'escalation.advanced'
  | 'escalation.acknowledged'
  | 'metrics.snapshot.created'
  | 'delivery_change_request.created'
  | 'delivery_change_request.updated';

export type WebSocketEventData = {
  event: WebSocketEvent;
  timestamp: string;
  data: any;
};

export type WebSocketChannel = 
  | `shipment:${string}`
  | `routes:${string}`
  | 'issues'
  | 'escalations'
  | 'metrics:overview'
  | 'delivery-changes';

type EventCallback = (data: WebSocketEventData) => void;

class WebSocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventCallbacks: Map<WebSocketEvent, Set<EventCallback>> = new Map();
  private channelSubscriptions: Set<WebSocketChannel> = new Set();

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<Socket> {
    if (this.socket?.connected) {
      return Promise.resolve(this.socket);
    }

    if (this.isConnecting) {
      return new Promise((resolve, reject) => {
        const checkConnection = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(checkConnection);
            resolve(this.socket!);
          }
          if (!this.isConnecting && !this.socket) {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
      });
    }

    this.isConnecting = true;
    const token = authApi.getToken();

    return new Promise((resolve, reject) => {
      this.socket = io(WS_BASE_URL, {
        auth: {
          token: token || undefined,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: this.maxReconnectAttempts,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id);
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Resubscribe to all channels
        this.channelSubscriptions.forEach((channel) => {
          this.subscribeToChannel(channel);
        });

        resolve(this.socket!);
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnecting = false;
        this.reconnectAttempts++;

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'));
        }
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected - reconnect manually
          this.reconnect();
        }
      });

      // Register all event listeners
      this.registerEventListeners();
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.channelSubscriptions.clear();
      this.eventCallbacks.clear();
    }
  }

  /**
   * Reconnect to WebSocket server
   */
  private reconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('WebSocket reconnect failed:', error);
        });
      }, this.reconnectDelay * (this.reconnectAttempts + 1));
    }
  }

  /**
   * Subscribe to a channel/room
   */
  async subscribeToChannel(channel: WebSocketChannel): Promise<boolean> {
    if (!this.socket?.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      this.socket.emit('joinRoom', channel, (response: { success?: boolean; error?: string }) => {
        if (response.success) {
          this.channelSubscriptions.add(channel);
          console.log('Subscribed to channel:', channel);
          resolve(true);
        } else {
          console.error('Failed to subscribe to channel:', channel, response.error);
          reject(new Error(response.error || 'Subscription failed'));
        }
      });
    });
  }

  /**
   * Unsubscribe from a channel/room
   */
  unsubscribeFromChannel(channel: WebSocketChannel): void {
    if (this.socket?.connected) {
      // Emit leaveRoom event if server supports it, otherwise just remove from local tracking
      this.socket.emit('leaveRoom', channel);
      this.channelSubscriptions.delete(channel);
      console.log('Unsubscribed from channel:', channel);
    }
  }

  /**
   * Register event listeners for all WebSocket events
   */
  private registerEventListeners(): void {
    if (!this.socket) return;

    const events: WebSocketEvent[] = [
      'shipment.scan.created',
      'shipment.status.updated',
      'issue.created',
      'issue.updated',
      'escalation.triggered',
      'escalation.advanced',
      'escalation.acknowledged',
      'metrics.snapshot.created',
    ];

    events.forEach((event) => {
      this.socket!.on(event, (data: WebSocketEventData) => {
        console.log('WebSocket event received:', event, data);
        
        // Notify all registered callbacks
        const callbacks = this.eventCallbacks.get(event);
        if (callbacks) {
          callbacks.forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Error in callback for event ${event}:`, error);
            }
          });
        }
      });
    });
  }

  /**
   * Subscribe to a specific event
   */
  on(event: WebSocketEvent, callback: EventCallback): () => void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventCallbacks.delete(event);
        }
      }
    };
  }

  /**
   * Unsubscribe from a specific event
   */
  off(event: WebSocketEvent, callback: EventCallback): void {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.eventCallbacks.delete(event);
      }
    }
  }

  /**
   * Get socket connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
