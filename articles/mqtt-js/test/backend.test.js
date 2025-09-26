require('./helpers/register-fake-mqtt');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const WebSocket = require('ws');
const mqtt = require('mqtt');

const { startBackend } = require('./helpers/backend-process');
const { getFreePort } = require('./helpers/free-port');
const { waitForStats } = require('./helpers/wait-for-stats');

test('backend HTTP endpoints and stats respond correctly', async t => {
  await t.test('GET /healthz returns ok', async () => {
    const port = await getFreePort();
    await startBackend(t, { port });
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(res.status, 200);
    const payload = await res.json();
    assert.deepEqual(payload, { status: 'ok' });
  });

  await t.test('invalid messages are counted', async () => {
    const port = await getFreePort();
    await startBackend(t, { port });

    const publisher = mqtt.connect();
    await once(publisher, 'connect');
    publisher.publish('fleet/demo/telemetry', 'not-json');
    publisher.end();
    await once(publisher, 'close');

    const stats = await waitForStats(port, data => data.invalidMessages === 1);
    assert.equal(stats.invalidMessages, 1);
    assert.equal(stats.totalMessages, 0);
  });

  await t.test('valid telemetry updates stats and vehicle count', async () => {
    const port = await getFreePort();
    await startBackend(t, { port });

    const publisher = mqtt.connect();
    await once(publisher, 'connect');
    const message = {
      vehicleId: 'unit-1',
      lat: 48.8566,
      lng: 2.3522,
      ts: new Date().toISOString(),
      fuelLevel: 82.5,
      engineStatus: 'running'
    };
    publisher.publish('fleet/demo/telemetry', JSON.stringify(message));
    publisher.end();
    await once(publisher, 'close');

    const stats = await waitForStats(port, data => data.totalMessages === 1);
    assert.equal(stats.totalMessages, 1);
    assert.equal(stats.invalidMessages, 0);
    assert.equal(stats.vehiclesTracked, 1);
    assert.equal(stats.connectedClients, 0);
    assert.equal(stats.messageRatePerSecond >= 0, true);
  });

  await t.test('WebSocket broadcast includes computed speed', async () => {
    const port = await getFreePort();
    await startBackend(t, { port });

    const ws = new WebSocket(`ws://127.0.0.1:${port}/stream`);
    t.after(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    });
    await once(ws, 'open');

    const publisher = mqtt.connect();
    await once(publisher, 'connect');

    const firstMessage = {
      vehicleId: 'speed-veh',
      lat: 48.8566,
      lng: 2.3522,
      ts: '2024-01-01T00:00:00.000Z',
      fuelLevel: 65,
      engineStatus: 'running'
    };
    publisher.publish('fleet/demo/telemetry', JSON.stringify(firstMessage));

    const [firstFrame] = await once(ws, 'message');
    const firstPayload = JSON.parse(firstFrame.toString());
    assert.equal(firstPayload.type, 'vehicle_update');
    assert.equal(firstPayload.version, 1);
    assert.equal(firstPayload.vehicleId, 'speed-veh');
    assert.equal(firstPayload.telemetry.speed, 0);
    assert.deepEqual(firstPayload.position, { lat: firstMessage.lat, lng: firstMessage.lng });

    const secondMessage = {
      vehicleId: 'speed-veh',
      lat: 48.8666,
      lng: 2.3622,
      ts: '2024-01-01T00:05:00.000Z',
      fuelLevel: 54.4,
      engineStatus: 'running'
    };
    publisher.publish('fleet/demo/telemetry', JSON.stringify(secondMessage));

    const [secondFrame] = await once(ws, 'message');
    const secondPayload = JSON.parse(secondFrame.toString());
    assert.equal(secondPayload.vehicleId, 'speed-veh');
    assert.ok(secondPayload.telemetry.speed > 0);

    const expectedSpeed = haversineKm(firstMessage.lat, firstMessage.lng, secondMessage.lat, secondMessage.lng) / (5 / 60);
    assert.ok(Math.abs(secondPayload.telemetry.speed - expectedSpeed) < 0.5);
    assert.equal(secondPayload.filters.engineStatus, 'running');
    assert.equal(secondPayload.filters.fuelLevel, secondPayload.telemetry.fuelLevel);

    publisher.end();
    await once(publisher, 'close');
  });

  await t.test('new WebSocket client receives latest vehicle snapshot on connect', async () => {
    const port = await getFreePort();
    await startBackend(t, { port });

    const publisher = mqtt.connect();
    await once(publisher, 'connect');

    const telemetry = {
      vehicleId: 'warm-veh',
      lat: 40.4168,
      lng: -3.7038,
      ts: new Date().toISOString(),
      fuelLevel: 71.2,
      engineStatus: 'idle'
    };
    publisher.publish('fleet/demo/telemetry', JSON.stringify(telemetry));
    await delay(25);
    publisher.end();
    await once(publisher, 'close');

    const ws = new WebSocket(`ws://127.0.0.1:${port}/stream`);
    t.after(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    });
    await once(ws, 'open');
    const [frame] = await once(ws, 'message');
    const payload = JSON.parse(frame.toString());
    assert.equal(payload.type, 'vehicle_update');
    assert.equal(payload.version, 1);
    assert.equal(payload.vehicleId, 'warm-veh');
    assert.equal(payload.position.lat, telemetry.lat);
    assert.equal(payload.position.lng, telemetry.lng);
    assert.equal(payload.telemetry.engineStatus, 'idle');
  });
});

function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = degrees => degrees * (Math.PI / 180);
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
