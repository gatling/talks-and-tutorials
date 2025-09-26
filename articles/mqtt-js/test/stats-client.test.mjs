import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createStatsClient } from '../frontend/src/services/stats-client.mjs';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('stats client polls at interval and emits data', async t => {
  const collected = [];
  const fetchCalls = [];
  const fetchImpl = async url => {
    fetchCalls.push(url);
    return {
      ok: true,
      async json() {
        return { messageRatePerSecond: 12.34, seq: fetchCalls.length };
      }
    };
  };

  const client = createStatsClient({
    baseUrl: 'http://localhost:8080',
    intervalMs: 20,
    fetchImpl,
    onData: data => collected.push(data)
  });

  client.start();
  assert.equal(fetchCalls.length, 1, 'should fetch immediately on start');
  await delay(35);
  assert.equal(fetchCalls.length, 2, 'should fetch again after interval');
  assert.equal(collected.length, 2);
  assert.equal(collected[1].seq, 2);

  client.stop();
  await delay(30);
  assert.equal(fetchCalls.length, 2, 'no additional polls after stop');
});

test('stats client forwards errors via callback', async t => {
  const errors = [];
  const fetchImpl = async () => {
    throw new Error('boom');
  };

  const client = createStatsClient({
    baseUrl: 'http://localhost:8080',
    intervalMs: 20,
    fetchImpl,
    onError: err => errors.push(err)
  });

  client.start();
  await Promise.resolve();
  assert.equal(errors.length, 1);

  await delay(30);
  assert.equal(errors.length, 2, 'error propagated on subsequent polls');

  client.stop();
});
