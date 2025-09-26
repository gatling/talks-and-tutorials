import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createMemoizedFormatter,
  escapeHtml,
  formatEngineStatus,
  formatFuelLevel,
  formatSpeed,
  normaliseFiniteNumber,
  normaliseStatus
} from '../frontend/src/utils/formatting.mjs';

test('createMemoizedFormatter caches results and evicts LRU entries', () => {
  let calls = 0;
  const double = createMemoizedFormatter(value => {
    calls += 1;
    return value * 2;
  }, { maxSize: 2 });

  assert.equal(double(2), 4);
  assert.equal(double(2), 4);
  assert.equal(calls, 1);

  assert.equal(double(3), 6);
  assert.equal(double(3), 6);
  assert.equal(calls, 2);

  assert.equal(double(4), 8);
  assert.equal(calls, 3);

  assert.equal(double(2), 4);
  assert.equal(calls, 4);
});

test('formatSpeed and formatFuelLevel memoize string conversions', () => {
  assert.equal(formatSpeed(85.456), '85.5 km/h');
  assert.equal(formatSpeed(Number.NaN), 'n/a');
  assert.equal(formatFuelLevel(17.234), '17.2%');
  assert.equal(formatFuelLevel(undefined), 'n/a');
});

test('formatEngineStatus normalises casing and escapes content', () => {
  assert.equal(formatEngineStatus(' RUNNING '), 'Running');
  assert.equal(formatEngineStatus(''), 'n/a');
  assert.equal(formatEngineStatus('<b>idle</b>'), '&lt;b&gt;idle&lt;/b&gt;');
});

test('normalise helpers coerce primitives safely', () => {
  assert.equal(normaliseFiniteNumber('42.5'), 42.5);
  assert.equal(normaliseFiniteNumber('nan'), null);
  assert.equal(normaliseStatus(' Idle '), 'idle');
  assert.equal(normaliseStatus(''), null);
  assert.equal(normaliseStatus(123), null);
});

test('escapeHtml encodes reserved characters', () => {
  assert.equal(escapeHtml('<span>"&</span>'), '&lt;span&gt;&quot;&amp;&lt;/span&gt;');
});
