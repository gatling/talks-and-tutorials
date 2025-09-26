export function createFrameThrottler({
  requestFrame = globalThis?.requestAnimationFrame?.bind(globalThis) || (cb => setTimeout(() => cb(nowFn()), 16)),
  cancelFrame = globalThis?.cancelAnimationFrame?.bind(globalThis) || clearTimeout,
  nowFn = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now())
} = {}) {
  let rafHandle = null;
  let lastExecution = 0;

  function schedule(callback, intervalMs = 0) {
    if (typeof callback !== 'function') {
      return;
    }
    const invoke = timestamp => {
      rafHandle = null;
      if (intervalMs > 0 && timestamp - lastExecution < intervalMs) {
        schedule(callback, intervalMs);
        return;
      }
      lastExecution = timestamp;
      callback(timestamp);
    };

    if (rafHandle !== null) {
      return;
    }

    rafHandle = requestFrame(invoke);
  }

  function cancel() {
    if (rafHandle !== null) {
      cancelFrame(rafHandle);
      rafHandle = null;
    }
  }

  return {
    schedule,
    cancel
  };
}

export function throttle(fn, wait) {
  if (typeof fn !== 'function') {
    throw new TypeError('Expected function for throttle');
  }
  const interval = Number(wait) || 0;
  let lastCall = 0;
  let timeout = null;
  let lastArgs;

  function invoke() {
    lastCall = Date.now();
    timeout = null;
    fn.apply(null, lastArgs);
  }

  return (...args) => {
    lastArgs = args;
    const now = Date.now();
    const remaining = interval - (now - lastCall);
    if (remaining <= 0) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke();
    } else if (!timeout) {
      timeout = setTimeout(invoke, remaining);
    }
  };
}
