const assert = require('node:assert/strict');
const { test } = require('node:test');

const { VehicleStore } = require('../backend/services/vehicle-store');

function createLoggerStub() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
}

test('VehicleStore evicts oldest vehicle when exceeding limit', () => {
  const store = new VehicleStore({ limit: 2, ttlMs: 0, logger: createLoggerStub() });
  store.set('veh-1', { vehicleId: 'veh-1', lastSeen: new Date().toISOString() });
  store.set('veh-2', { vehicleId: 'veh-2', lastSeen: new Date().toISOString() });
  store.set('veh-3', { vehicleId: 'veh-3', lastSeen: new Date().toISOString() });

  assert.equal(store.size(), 2);
  assert.equal(store.get('veh-1'), undefined);
  assert.ok(store.get('veh-2'));
  assert.ok(store.get('veh-3'));

  store.stop();
});

test('VehicleStore expires stale vehicles and invokes onExpire', () => {
  let expired = [];
  const ttlMs = 50;
  const store = new VehicleStore({
    limit: 10,
    ttlMs,
    logger: createLoggerStub(),
    onExpire: (vehicleId, vehicle) => {
      expired.push({ vehicleId, vehicle });
    }
  });

  const now = Date.now();
  store.set('fresh', { vehicleId: 'fresh', lastSeen: new Date(now).toISOString() });
  store.set('stale', { vehicleId: 'stale', lastSeen: new Date(now - ttlMs - 10).toISOString() });

  store.pruneExpired(now);

  assert.equal(store.size(), 1);
  assert.equal(store.get('stale'), undefined);
  assert.deepEqual(expired, [{ vehicleId: 'stale', vehicle: { vehicleId: 'stale', lastSeen: new Date(now - ttlMs - 10).toISOString() } }]);

  // Test adding another expired vehicle after stopping the timer
  // Use a future timestamp that ensures fresh vehicle doesn't expire
  const futureTime = now + 30; // Only 30ms later, within TTL for fresh
  const lateTimestamp = new Date(futureTime - ttlMs - 10).toISOString(); // This will be expired
  store.set('late', { vehicleId: 'late', lastSeen: lateTimestamp });
  
  // Reset expired array to test just this new expiration
  expired = [];
  store.pruneExpired(futureTime);

  assert.equal(expired.length, 1);
  assert.equal(expired[0].vehicleId, 'late');
  assert.equal(store.get('late'), undefined);

  store.stop();
});

test('VehicleStore setOnExpire replaces handler', () => {
  const store = new VehicleStore({ limit: 5, ttlMs: 25, logger: createLoggerStub() });
  let calls = 0;
  store.setOnExpire(() => {
    calls += 1;
  });

  store.set('vehicle-1', {
    vehicleId: 'vehicle-1',
    lastSeen: new Date(Date.now() - 1000).toISOString()
  });

  store.pruneExpired(Date.now());
  assert.equal(calls, 1);
  store.stop();
});
