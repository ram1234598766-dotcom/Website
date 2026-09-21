'use client';

type MessageHandler = (data: unknown) => void;
type OpenHandler = () => void;
type CloseHandler = () => void;
type ErrorHandler = (err: Event) => void;

export interface WebSocketSyncTransportOptions {
  url: string;
  maxReconnectAttempts?: number;
  reconnectBaseDelay?: number;
  reconnectMaxDelay?: number;
  heartbeatIntervalMs?: number;
}

export interface WebSocketSyncTransport {
  connect(): void;
  disconnect(): void;
  send(data: unknown): void;
  onMessage(handler: MessageHandler): () => void;
  onOpen(handler: OpenHandler): () => void;
  onClose(handler: CloseHandler): () => void;
  onError(handler: ErrorHandler): () => void;
  isConnected(): boolean;
  getReconnectCount(): number;
}

export function createWebSocketTransport(
  opts: WebSocketSyncTransportOptions
): WebSocketSyncTransport {
  const {
    url,
    maxReconnectAttempts = 10,
    reconnectBaseDelay = 1000,
    reconnectMaxDelay = 30000,
    heartbeatIntervalMs = 30000,
  } = opts;

  let ws: WebSocket | null = null;
  let connected = false;
  let reconnectCount = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let manuallyClosed = false;

  const messageHandlers = new Set<MessageHandler>();
  const openHandlers = new Set<OpenHandler>();
  const closeHandlers = new Set<CloseHandler>();
  const errorHandlers = new Set<ErrorHandler>();

  function clearTimers() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function startHeartbeat() {
    clearTimers();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: '__ping__' }));
        } catch {
          /* ignore — connection will be detected as closed on next attempt */
        }
      }
    }, heartbeatIntervalMs);
  }

  function scheduleReconnect() {
    if (manuallyClosed) return;
    if (reconnectCount >= maxReconnectAttempts) return;

    const delay = Math.min(
      reconnectBaseDelay * Math.pow(2, reconnectCount),
      reconnectMaxDelay
    );
    reconnectCount += 1;

    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  }

  function handleOpen() {
    connected = true;
    reconnectCount = 0;
    startHeartbeat();
    openHandlers.forEach((h) => h());
  }

  function handleMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === '__pong__') return;
      messageHandlers.forEach((h) => h(data));
    } catch {
      messageHandlers.forEach((h) => h(event.data));
    }
  }

  function handleClose() {
    connected = false;
    clearTimers();
    closeHandlers.forEach((h) => h());
    if (!manuallyClosed) {
      scheduleReconnect();
    }
  }

  function handleError(err: Event) {
    errorHandlers.forEach((h) => h(err));
  }

  function connect() {
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }

    manuallyClosed = false;

    try {
      ws = new WebSocket(url);
      ws.onopen = handleOpen;
      ws.onmessage = handleMessage;
      ws.onclose = handleClose;
      ws.onerror = handleError;
    } catch {
      scheduleReconnect();
    }
  }

  function disconnect() {
    manuallyClosed = true;
    clearTimers();
    connected = false;
    if (ws) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }
  }

  function send(data: unknown) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(data));
      } catch {
        /* ignore */
      }
    }
  }

  return {
    connect,
    disconnect,
    send,
    onMessage: (handler: MessageHandler) => {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    onOpen: (handler: OpenHandler) => {
      openHandlers.add(handler);
      return () => {
        openHandlers.delete(handler);
      };
    },
    onClose: (handler: CloseHandler) => {
      closeHandlers.add(handler);
      return () => {
        closeHandlers.delete(handler);
      };
    },
    onError: (handler: ErrorHandler) => {
      errorHandlers.add(handler);
      return () => {
        errorHandlers.delete(handler);
      };
    },
    isConnected: () => connected,
    getReconnectCount: () => reconnectCount,
  };
}
