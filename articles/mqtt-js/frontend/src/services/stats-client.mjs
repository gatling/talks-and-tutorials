export function createStatsClient({
  baseUrl,
  intervalMs = 5000,
  fetchImpl = (...args) => fetch(...args),
  onData,
  onError,
  logger = console
} = {}) {
  if (!baseUrl) {
    throw new Error('stats client requires baseUrl');
  }

  let timer = null;
  let running = false;

  async function poll() {
    try {
      const response = await fetchImpl(`${baseUrl}/stats`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const json = await response.json();
      if (typeof onData === 'function') {
        onData(json);
      }
    } catch (err) {
      logger.error('[frontend] stats poll failed', err);
      if (typeof onError === 'function') {
        onError(err);
      }
    }
  }

  function start() {
    if (running) {
      return;
    }
    running = true;
    void poll();
    timer = setInterval(poll, intervalMs);
  }

  function stop() {
    if (!running) {
      return;
    }
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop
  };
}
