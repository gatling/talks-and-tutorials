const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const WebSocket = require('ws');

const { createWebSocketService } = require('../backend/services/websocket-service');

function createLoggerStub() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
}

test('WebSocket service sends snapshot and enforces backpressure', async t => {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, resolve));
  const { port } = server.address();

  const vehicles = [
    {
      vehicleId: 'snap-1',
      lat: 10,
      lng: 20,
      ts: '2024-01-01T00:00:00.000Z',
      speed: 0,
      fuelLevel: 70,
      engineStatus: 'idle',
      lastSeen: '2024-01-01T00:00:00.000Z'
    }
  ];

  const vehicleStore = {
    values() {
      return vehicles[Symbol.iterator]();
    }
  };

  const service = createWebSocketService({
    server,
    path: '/stream',
    logger: createLoggerStub(),
    vehicleStore,
    payloadVersion: 1
  });

  const connectionPromise = once(service.wss, 'connection');

  const ws = new WebSocket(`ws://127.0.0.1:${port}/stream`);
  t.after(() => {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  });

  const [snapshotFrame] = await once(ws, 'message');
  const snapshotPayload = JSON.parse(snapshotFrame.toString());
  assert.equal(snapshotPayload.type, 'vehicle_update');
  assert.equal(snapshotPayload.vehicleId, 'snap-1');
  assert.equal(snapshotPayload.telemetry.engineStatus, 'idle');

  const [serverSocket] = await connectionPromise;
  Object.defineProperty(serverSocket, 'bufferedAmount', {
    configurable: true,
    get() {
      return 600 * 1024;
    }
  });

  service.broadcastUpdate({
    vehicleId: 'snap-1',
    lat: 11,
    lng: 21,
    ts: '2024-01-01T00:01:00.000Z',
    speed: 4.2,
    fuelLevel: 68,
    engineStatus: 'running',
    lastSeen: '2024-01-01T00:01:00.000Z'
  });

  assert.equal(service.clientCount(), 0);

  ws.close();
  await delay(10);
  await new Promise(resolve => service.close(resolve));
  await new Promise(resolve => server.close(resolve));
});
