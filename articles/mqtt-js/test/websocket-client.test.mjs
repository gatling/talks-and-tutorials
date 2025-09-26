import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createWebSocketClient, MESSAGE_TYPES } from '../frontend/src/services/websocket-client.mjs';

class FakeWebSocket {
  static instances = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.listeners = new Map();
    this.closeCalls = [];
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type, detail = {}) {
    if (type === 'open') {
      this.readyState = FakeWebSocket.OPEN;
    }
    if (type === 'close') {
      this.readyState = FakeWebSocket.CLOSED;
    }
    const event = { ...detail, type };
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSING;
  }
}

function withFakeWebSocket(t) {
  const originalWindow = global.window;
  const originalWebSocket = global.WebSocket;
  global.window = { location: { href: 'http://localhost/' } };
  global.WebSocket = FakeWebSocket;
  t.after(() => {
    global.window = originalWindow;
    global.WebSocket = originalWebSocket;
    FakeWebSocket.instances = [];
  });
}

test('websocket client connects and routes messages', async t => {
  withFakeWebSocket(t);
  const statuses = [];
  const updates = [];
  const removals = [];
  const errors = [];

  const client = createWebSocketClient({
    url: '/stream',
    onStatusChange: status => statuses.push(status),
    onUpdate: payload => updates.push(payload.vehicleId),
    onRemove: payload => removals.push(payload.vehicleId),
    onError: err => errors.push(err)
  });

  client.connect();
  assert.equal(statuses.at(-1), 'connecting');
  assert.equal(FakeWebSocket.instances.length, 1);
  const socket = FakeWebSocket.instances[0];

  socket.emit('open');
  assert.equal(statuses.at(-1), 'connected');

  socket.emit('message', { data: JSON.stringify({ version: 1, type: MESSAGE_TYPES.UPDATE, vehicleId: 'veh-1' }) });
  socket.emit('message', { data: JSON.stringify({ version: 999, type: MESSAGE_TYPES.UPDATE, vehicleId: 'veh-ignored' }) });
  socket.emit('message', { data: JSON.stringify({ version: 1, type: MESSAGE_TYPES.REMOVE, vehicleId: 'veh-2' }) });
  socket.emit('message', { data: '{"not":"json"' });

  assert.deepEqual(updates, ['veh-1']);
  assert.deepEqual(removals, ['veh-2']);
  assert.equal(errors.length, 0);

  client.destroy();
});

test('websocket client schedules reconnect with backoff and manual reconnect', async t => {
  withFakeWebSocket(t);
  const statuses = [];
  const client = createWebSocketClient({
    url: '/ws',
    baseDelayMs: 20,
    maxDelayMs: 50,
    onStatusChange: status => statuses.push(status)
  });

  client.connect();
  const firstSocket = FakeWebSocket.instances[0];
  firstSocket.emit('open');
  assert.equal(statuses.at(-1), 'connected');

  firstSocket.emit('close');
  assert.equal(statuses.at(-1), 'disconnected');
  assert.equal(FakeWebSocket.instances.length, 1);

  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(FakeWebSocket.instances.length, 2, 'expected reconnect after backoff');

  // Manual reconnect closes the existing socket and opens a new one immediately.
  const secondSocket = FakeWebSocket.instances[1];
  secondSocket.readyState = FakeWebSocket.OPEN;
  client.reconnect();
  assert.equal(secondSocket.closeCalls.length, 1);
  assert.equal(FakeWebSocket.instances.length, 3, 'manual reconnect should open a new socket immediately');
  assert.equal(statuses.at(-1), 'connecting');

  client.destroy();
});
