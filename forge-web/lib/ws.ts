/**
 * WebSocket client for Forge real-time events.
 *
 * Connects to /ws/projects/{slug}/events and dispatches
 * typed event handlers. Supports reconnection with exponential backoff.
 */

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export interface ForgeEvent {
  event: string;
  project: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type EventHandler = (event: ForgeEvent) => void;

export class ForgeWebSocket {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private globalHandlers: Set<EventHandler> = new Set();
  private reconnectAttempt = 0;
  private maxReconnectAttempt = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private slug: string;
  private token: string | null;

  constructor(slug: string, token?: string | null) {
    this.slug = slug;
    this.token = token ?? null;
  }

  connect(): void {
    if (
      this.ws?.readyState === WebSocket.OPEN ||
      this.ws?.readyState === WebSocket.CONNECTING
    ) return;

    const params = this.token ? `?token=${encodeURIComponent(this.token)}` : "";
    const url = `${WS_BASE}/ws/projects/${this.slug}/events${params}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
    };

    this.ws.onmessage = (msg) => {
      try {
        const event: ForgeEvent = JSON.parse(msg.data);
        this.dispatch(event);
      } catch {
        // Ignore non-JSON messages
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempt = this.maxReconnectAttempt; // Prevent reconnection
    this.ws?.close();
    this.ws = null;
  }

  /** Subscribe to a specific event type. */
  on(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  /** Subscribe to all events. */
  onAny(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private dispatch(event: ForgeEvent): void {
    // Type-specific handlers
    const handlers = this.handlers.get(event.event);
    if (handlers) {
      handlers.forEach((h) => h(event));
    }
    // Global handlers
    this.globalHandlers.forEach((h) => h(event));
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.maxReconnectAttempt) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30000);
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
