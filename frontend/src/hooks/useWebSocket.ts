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

  // Keep all callbacks in refs so they never appear in the effect deps.
  // The effect only re-runs when url or enabled changes.
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
    onErrorRef.current = onError;
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

    ws.onopen = () => onOpenRef.current?.();
    ws.onclose = () => onCloseRef.current?.();
    ws.onerror = (e) => onErrorRef.current?.(e);
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
  }, [url, enabled]); // callbacks intentionally excluded — they live in refs

  return { send };
}
