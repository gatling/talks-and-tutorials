const assert = require('node:assert/strict');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const WebSocket = require('ws');

const { startBackend } = require('./helpers/backend-process');
const { runSimulator } = require('./helpers/run-simulator');
const { getFreePort } = require('./helpers/free-port');
const { waitForStats } = require('./helpers/wait-for-stats');

test('simulator to backend end-to-end flow updates stats and WebSocket clients', async t => {
  const port = await getFreePort();
  await startBackend(t, { port });

  // Ensure the simulator process is properly awaited and terminated
  const simulator = runSimulator([
    '--topic', 'fleet/demo/telemetry',
    '--seed', 'e2e',
    '--region', 'paris',
    '--vehicles', '1',
    '--max-messages', '1',
    '--rate', '100ms'
  ]);
  const result = await simulator;
  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');

  await waitForStats(port, data => data.totalMessages === 1 && data.invalidMessages === 0);

  const ws = new WebSocket(`ws://127.0.0.1:${port}/stream`);
  t.after(() => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  });

  await once(ws, 'open');

  const [message] = await Promise.race([
    once(ws, 'message'),
    delay(2000).then(() => { throw new Error('Timed out waiting for WebSocket message'); })
  ]);

  const payload = JSON.parse(message.toString());
  assert.equal(payload.type, 'vehicle_update');
  assert.equal(payload.version, 1);
  assert.match(payload.vehicleId, /^paris-[0-9a-z]{6}$/);
  assert.equal(typeof payload.position.lat, 'number');
  assert.equal(typeof payload.position.lng, 'number');
  assert.equal(typeof payload.telemetry.timestamp, 'string');
  assert.equal(typeof payload.telemetry.speed, 'number');
  assert.equal(typeof payload.telemetry.fuelLevel, 'number');
  assert.ok(['running', 'idle', 'off'].includes(payload.telemetry.engineStatus));
  assert.equal(payload.filters.engineStatus, payload.telemetry.engineStatus);
  assert.equal(payload.filters.fuelLevel, payload.telemetry.fuelLevel);

  const stats = await waitForStats(port, data => data.connectedClients === 1 && data.vehiclesTracked === 1);
  assert.equal(stats.totalMessages, 1);
  assert.equal(stats.invalidMessages, 0);
});
