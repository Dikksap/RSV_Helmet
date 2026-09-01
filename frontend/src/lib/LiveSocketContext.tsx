import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type NotifPayload = {
  type: string;
  message: string;
  data: unknown;
};

type LiveSocketValue = {
  isConnected: boolean;
  subscribe: (callback: (payload: NotifPayload) => void) => () => void;
};

const LiveSocketContext = createContext<LiveSocketValue | null>(null);

const SOCKET_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
const RECONNECT_DELAY_MS = 5000;

export function LiveSocketProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const subscribersRef = useRef(new Set<(payload: NotifPayload) => void>());
  const retryRef = useRef<number | undefined>(undefined);
  const disposedRef = useRef(false);

  useEffect(() => {
    let socket: WebSocket | null = null;

    const connect = () => {
      socket = new WebSocket(SOCKET_URL);
      socket.addEventListener("open", () => {
        if (!disposedRef.current) setIsConnected(true);
      });
      socket.addEventListener("close", () => {
        if (!disposedRef.current) {
          setIsConnected(false);
          retryRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
      socket.addEventListener("error", () => {
        if (!disposedRef.current) setIsConnected(false);
      });
      socket.addEventListener("message", (event) => {
        try {
          const raw = JSON.parse(event.data as string) as {
            event?: string;
            type?: string;
            message?: string;
            data?: unknown;
          };
          const eventType = raw.event ?? raw.type;
          if (!eventType) return;
          const payload: NotifPayload = {
            type: eventType,
            message: raw.message ?? "",
            data: raw.data ?? null,
          };
          subscribersRef.current.forEach((cb) => cb(payload));
        } catch {
          // ignore non-JSON
        }
      });
    };

    connect();

    return () => {
      disposedRef.current = true;
      if (retryRef.current !== undefined) {
        window.clearTimeout(retryRef.current);
      }
      if (socket && socket.readyState === WebSocket.CONNECTING) {
        const pending = socket;
        pending.addEventListener("open", () => pending.close(), {
          once: true,
        });
      } else {
        socket?.close();
      }
    };
  }, []);

  const subscribe = (callback: (payload: NotifPayload) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  };

  return (
    <LiveSocketContext.Provider value={{ isConnected, subscribe }}>
      {children}
    </LiveSocketContext.Provider>
  );
}

export function useLiveSocketContext(): LiveSocketValue {
  const ctx = useContext(LiveSocketContext);
  if (!ctx) {
    throw new Error(
      "useLiveSocketContext must be used within LiveSocketProvider",
    );
  }
  return ctx;
}
