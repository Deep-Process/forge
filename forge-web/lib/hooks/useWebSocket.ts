"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { ForgeWebSocket, type ForgeEvent, type EventHandler } from "../ws";
import { getToken } from "../api";

/**
 * React hook for subscribing to Forge real-time events.
 *
 * Creates a WebSocket connection for the given project slug,
 * auto-connects on mount, disconnects on unmount.
 */
export function useWebSocket(slug: string | null) {
  const wsRef = useRef<ForgeWebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!slug) return;

    const ws = new ForgeWebSocket(slug, getToken());
    wsRef.current = ws;
    ws.connect();

    // Poll connection status (WebSocket API has no onconnected callback we can hook into cleanly)
    const interval = setInterval(() => {
      setConnected(ws.connected);
    }, 1000);

    return () => {
      clearInterval(interval);
      ws.disconnect();
      wsRef.current = null;
      setConnected(false);
    };
  }, [slug]);

  const on = useCallback(
    (eventType: string, handler: EventHandler) => {
      return wsRef.current?.on(eventType, handler) ?? (() => {});
    },
    [],
  );

  const onAny = useCallback(
    (handler: EventHandler) => {
      return wsRef.current?.onAny(handler) ?? (() => {});
    },
    [],
  );

  return { connected, on, onAny };
}

export type { ForgeEvent, EventHandler };
