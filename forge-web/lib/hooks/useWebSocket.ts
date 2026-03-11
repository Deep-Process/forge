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
  const [instanceId, setInstanceId] = useState(0);

  useEffect(() => {
    if (!slug) return;

    const ws = new ForgeWebSocket(slug, getToken());
    wsRef.current = ws;
    ws.connect();
    setInstanceId((prev) => prev + 1);

    // Poll connection status
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instanceId],
  );

  const onAny = useCallback(
    (handler: EventHandler) => {
      return wsRef.current?.onAny(handler) ?? (() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instanceId],
  );

  return { connected, on, onAny };
}

export type { ForgeEvent, EventHandler };
