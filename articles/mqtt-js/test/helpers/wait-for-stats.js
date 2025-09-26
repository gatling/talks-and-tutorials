const { setTimeout: delay } = require('node:timers/promises');

async function waitForStats(port, predicate, { timeoutMs = 2000, pollIntervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const res = await fetch(`http://127.0.0.1:${port}/stats`);
    if (res.ok) {
      last = await res.json();
      if (predicate(last)) {
        return last;
      }
    }
    await delay(pollIntervalMs);
  }
  const details = last ? JSON.stringify(last) : 'no response';
  throw new Error(`timed out waiting for stats condition, last value: ${details}`);
}

module.exports = {
  waitForStats
};
