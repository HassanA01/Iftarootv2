import { useEffect, useRef, useCallback } from "react";
import type { WsMessage } from "../types";

interface UseWebSocketOptions {
  url: string;
  onMessage: (msg: WsMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  enabled?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
  onError,
  enabled = true,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  const send = useCallback((msg: WsMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => onOpen?.();
    ws.onclose = () => onClose?.();
    ws.onerror = (e) => onError?.(e);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WsMessage;
        onMessageRef.current(msg);
      } catch {
        console.error("Failed to parse WS message", event.data);
      }
    };

    return () => {
      ws.close();
    };
  }, [url, enabled, onOpen, onClose, onError]);

  return { send };
}
