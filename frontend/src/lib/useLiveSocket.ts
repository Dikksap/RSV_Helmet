import { useEffect, useRef, useState } from "react";

const SOCKET_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
const RECONNECT_DELAY_MS = 5000;
const LIVE_EVENT_PREFIXES = ["barang.", "product.", "variant."];

function isLiveEvent(eventName: string): boolean {
  return LIVE_EVENT_PREFIXES.some((prefix) => eventName.startsWith(prefix));
}

export function useLiveSocket(onEvent: () => void): boolean {
  const [isConnected, setIsConnected] = useState(false);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retryId: number | undefined;
    let disposed = false;

    const connect = () => {
      socket = new WebSocket(SOCKET_URL);
      socket.addEventListener("open", () => {
        if (!disposed) setIsConnected(true);
      });
      socket.addEventListener("close", () => {
        if (!disposed) {
          setIsConnected(false);
          retryId = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
      socket.addEventListener("error", () => setIsConnected(false));
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            event?: string;
            type?: string;
          };
          const eventName = payload.event ?? payload.type ?? "";
          if (isLiveEvent(eventName)) {
            onEventRef.current();
          }
        } catch {
          // Ignore non-JSON WebSocket messages.
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      if (retryId !== undefined) window.clearTimeout(retryId);
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        // Defer close to the open event so the browser does not log
        // "WebSocket is closed before the connection is established".
        const pending = socket;
        pending.addEventListener("open", () => pending.close(), {
          once: true,
        });
      } else {
        socket?.close();
      }
    };
  }, []);

  return isConnected;
}
