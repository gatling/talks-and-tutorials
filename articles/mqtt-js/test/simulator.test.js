const assert = require('node:assert/strict');
const { test } = require('node:test');
const { runSimulator } = require('./helpers/run-simulator');

test('simulator publishes a message with provided options', async () => {
  const { code, stderr, jsonLogs } = await runSimulator([
    '--host', 'fake-host',
    '--port', '1883',
    '--topic', 'fleet/demo/telemetry',
    '--seed', 'unit',
    '--region', 'paris',
    '--vehicles', '1',
    '--max-messages', '1'
  ]);

  assert.equal(code, 0);
  assert.equal(stderr, '');
  assert.ok(jsonLogs.length > 0, 'expected structured logs');

  const connectedLog = jsonLogs.find(line => line.msg === 'connected');
  assert.ok(connectedLog, 'expected connection log');
  assert.equal(connectedLog.host, 'fake-host');
  assert.equal(connectedLog.port, 1883);

  const publishLog = jsonLogs.find(line => line.msg === 'first publish');
  assert.ok(publishLog, 'expected first publish log');
  const payload = publishLog.payload;
  assert.ok(payload, 'expected telemetry payload');
  assert.match(payload.vehicleId, /^paris-[0-9a-z]{6}$/);
  assert.equal(typeof payload.lat, 'number');
  assert.equal(typeof payload.lng, 'number');
  assert.ok(!Number.isNaN(Date.parse(payload.ts)));
  assert.equal(typeof payload.fuelLevel, 'number');
  assert.ok(payload.fuelLevel >= 0 && payload.fuelLevel <= 100);
  assert.ok(['running', 'idle', 'off'].includes(payload.engineStatus));
});

test('simulator exits with error when flag value is missing', async () => {
  const { code, stdout, stderr } = await runSimulator(['--vehicles']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /flag "--vehicles" requires a value/);
});

test('simulator exits with error on invalid duration', async () => {
  const { code, stderr } = await runSimulator(['--rate', 'bogus']);
  assert.equal(code, 1);
  assert.match(stderr, /invalid rate value/);
});
