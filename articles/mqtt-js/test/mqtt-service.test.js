require('./helpers/register-fake-mqtt');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const mqtt = require('mqtt');

const { VehicleStore } = require('../backend/services/vehicle-store');
const { createMqttService } = require('../backend/services/mqtt-service');

function createLoggerStub() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
}

function createBaseConfig() {
  return {
    broker: {
      host: 'localhost',
      port: 1883,
      username: null,
      password: null,
      useTls: false,
      rejectUnauthorized: true,
      clientId: null
    },
    subscriptionTopic: 'fleet/+/telemetry',
    messageWindowMs: 60_000
  };
}

function createState() {
  return {
    mqttConnected: false,
    totalMessages: 0,
    invalidMessages: 0,
    messageTimestamps: []
  };
}

test('MQTT service counts invalid messages', async t => {
  const state = createState();
  const vehicleStore = new VehicleStore({ limit: 5, ttlMs: 0, logger: createLoggerStub() });
  const websocketService = { broadcastUpdate: () => {} };
  const config = createBaseConfig();
  const mqttService = createMqttService({ config, logger: createLoggerStub(), vehicleStore, websocketService, state });
  t.after(() => new Promise(resolve => mqttService.disconnect(resolve)));
  t.after(() => mqtt.__reset());

  await once(mqttService.client, 'connect');

  const publisher = mqtt.connect();
  await once(publisher, 'connect');
  publisher.publish('fleet/demo/telemetry', 'not-json');

  await delay(10);
  assert.equal(state.invalidMessages, 1);
  assert.equal(state.totalMessages, 0);

  publisher.end();
  await once(publisher, 'close');

  vehicleStore.stop();
});

test('MQTT service enriches telemetry and broadcasts updates', async t => {
  const state = createState();
  const vehicleStore = new VehicleStore({ limit: 5, ttlMs: 0, logger: createLoggerStub() });
  const updates = [];
  const updateEmitter = new EventEmitter();
  const websocketService = {
    broadcastUpdate: vehicle => {
      updates.push(vehicle);
      updateEmitter.emit('update', vehicle);
    }
  };
  const config = createBaseConfig();
  const mqttService = createMqttService({ config, logger: createLoggerStub(), vehicleStore, websocketService, state });
  t.after(() => new Promise(resolve => mqttService.disconnect(resolve)));
  t.after(() => mqtt.__reset());

  await once(mqttService.client, 'connect');

  const publisher = mqtt.connect();
  await once(publisher, 'connect');

  const first = {
    vehicleId: 'unit-99',
    lat: 52.52,
    lng: 13.405,
    ts: '2024-01-01T00:00:00.000Z',
    fuelLevel: 80,
    engineStatus: 'running'
  };
  publisher.publish('fleet/demo/telemetry', JSON.stringify(first));
  await once(updateEmitter, 'update');

  const second = {
    vehicleId: 'unit-99',
    lat: 52.53,
    lng: 13.415,
    ts: '2024-01-01T00:05:00.000Z',
    fuelLevel: 78,
    engineStatus: 'running'
  };
  publisher.publish('fleet/demo/telemetry', JSON.stringify(second));
  await once(updateEmitter, 'update');

  assert.equal(state.totalMessages, 2);
  assert.equal(state.invalidMessages, 0);
  assert.equal(vehicleStore.size(), 1);

  const latest = vehicleStore.get('unit-99');
  assert.equal(latest.engineStatus, 'running');
  assert.equal(latest.lat, second.lat);
  assert.equal(latest.lng, second.lng);
  assert.ok(latest.speed > 0);

  assert.equal(updates.length, 2);
  assert.ok(updates[1].speed > 0);

  publisher.end();
  await once(publisher, 'close');
  vehicleStore.stop();
});
