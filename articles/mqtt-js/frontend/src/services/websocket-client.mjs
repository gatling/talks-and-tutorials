const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_MAX_DELAY_MS = 10_000;
const DEFAULT_BASE_DELAY_MS = 1_000;

export const MESSAGE_TYPES = {
  UPDATE: 'vehicle_update',
  REMOVE: 'vehicle_remove'
};

export function createWebSocketClient({
  url,
  version = 1,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  onUpdate,
  onRemove,
  onError,
  onStatusChange,
  logger = console
} = {}) {
  if (!url) {
    throw new Error('WebSocket client requires a URL');
  }

  let socket = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  function notifyStatus(status) {
    if (typeof onStatusChange === 'function') {
      onStatusChange(status);
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function connect() {
    clearReconnectTimer();
    notifyStatus('connecting');

    let resolvedUrl;
    try {
      resolvedUrl = new URL(url, window.location.href);
    } catch (err) {
      logger.error('[frontend] Invalid WebSocket URL', err);
      if (typeof onError === 'function') {
        onError(err);
      }
      return;
    }

    socket = new WebSocket(resolvedUrl);

    socket.addEventListener('open', handleOpen);
    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', handleClose);
    socket.addEventListener('error', handleSocketError);
  }

  function disconnect(code, reason) {
    if (!socket) {
      return;
    }
    try {
      socket.removeEventListener('open', handleOpen);
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('close', handleClose);
      socket.removeEventListener('error', handleSocketError);
      socket.close(code, reason);
    } catch (err) {
      logger.error('[frontend] error closing socket', err);
    }
    socket = null;
  }

  function handleOpen() {
    reconnectAttempts = 0;
    notifyStatus('connected');
  }

  function handleMessage(event) {
    const rawData = event?.data;
    try {
      const payload = JSON.parse(rawData);
      if (!payload || typeof payload !== 'object') {
        return;
      }
      if (payload.version !== version) {
        logger.warn('[frontend] Ignoring message with unsupported version', payload.version);
        return;
      }
      switch (payload.type) {
        case MESSAGE_TYPES.UPDATE:
          if (typeof onUpdate === 'function') {
            onUpdate(payload);
          }
          break;
        case MESSAGE_TYPES.REMOVE:
          if (typeof onRemove === 'function') {
            onRemove(payload);
          }
          break;
        default:
          logger.warn('[frontend] Unknown WebSocket message type', payload.type);
      }
    } catch (err) {
      logger.error('[frontend] Failed to parse WebSocket payload', err);
    }
  }

  function handleClose() {
    notifyStatus('disconnected');
    socket = null;
    scheduleReconnect();
  }

  function handleSocketError(err) {
    logger.error('[frontend] WebSocket error', err);
    if (typeof onError === 'function') {
      onError(err);
    }
    try {
      socket?.close();
    } catch (closeErr) {
      logger.error('[frontend] Unable to close socket after error', closeErr);
    }
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectAttempts = Math.min(reconnectAttempts + 1, maxAttempts);
    const delay = Math.min(baseDelayMs * (2 ** (reconnectAttempts - 1)), maxDelayMs);
    reconnectTimer = setTimeout(connect, delay);
  }

  function manualReconnect() {
    reconnectAttempts = 0;
    if (socket && socket.readyState <= WebSocket.OPEN) {
      disconnect(1000, 'manual reconnect');
    }
    connect();
  }

  function destroy() {
    clearReconnectTimer();
    disconnect(1000, 'destroy');
  }

  return {
    connect,
    reconnect: manualReconnect,
    destroy,
    getSocket: () => socket
  };
}
