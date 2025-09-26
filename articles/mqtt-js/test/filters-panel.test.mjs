import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createFiltersPanel } from '../frontend/src/components/sidebar/filters-panel.mjs';

function createInput(value = '0') {
  const listeners = new Map();
  return {
    value,
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    trigger(type, event = {}) {
      listeners.get(type)?.({ target: this, ...event });
    }
  };
}

function createButton(status) {
  const listeners = new Map();
  const classes = new Set();
  const attributes = new Map();
  return {
    dataset: { status },
    classList: {
      toggle(className, active) {
        if (active) {
          classes.add(className);
        } else {
          classes.delete(className);
        }
      }
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    getAttribute(name) {
      return attributes.get(name);
    },
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    click() {
      listeners.get('click')?.();
    },
    classes,
    attributes
  };
}

test('filters panel updates fuel threshold and notifies subscribers', () => {
  const input = createInput('30');
  const fuelLabel = { textContent: '' };
  const panel = createFiltersPanel({
    fuelInput: input,
    fuelValueElement: fuelLabel,
    statusButtons: []
  });

  assert.equal(panel.state.minFuel, 30);
  assert.equal(fuelLabel.textContent, '30%');

  const states = [];
  panel.onChange(state => states.push(state));

  input.value = '55';
  input.trigger('input');

  assert.equal(panel.state.minFuel, 55);
  assert.equal(fuelLabel.textContent, '55%');
  assert.equal(states.length, 1);
  assert.equal(states[0].minFuel, 55);
});

test('filters panel toggles statuses and enforces at least one selection', () => {
  const toastMessages = [];
  const buttons = [
    createButton('running'),
    createButton('idle'),
    createButton('off'),
    createButton('all')
  ];

  const panel = createFiltersPanel({
    statusButtons: buttons,
    toast: (message, variant) => toastMessages.push({ message, variant })
  });

  const [runningBtn, idleBtn, offBtn, allBtn] = buttons;

  runningBtn.click();
  idleBtn.click();
  assert.equal(panel.state.statuses.has('running'), false);
  assert.equal(panel.state.statuses.has('idle'), false);
  assert.equal(panel.state.statuses.has('off'), true);

  offBtn.click();
  assert.equal(toastMessages.length, 1, 'should warn when last status removed');
  assert.equal(panel.state.statuses.has('off'), true, 'last status remains active');

  allBtn.click();
  assert.equal(panel.state.statuses.size, 3, 'all filter resets selections');
});

test('filters panel matches entries by fuel and status', () => {
  const panel = createFiltersPanel();
  panel.state.minFuel = 40;
  panel.state.statuses = new Set(['running', 'idle']);

  assert.equal(panel.matches({ fuelLevel: 50, engineStatus: 'running' }), true);
  assert.equal(panel.matches({ fuelLevel: 30, engineStatus: 'running' }), false, 'fails fuel threshold');
  assert.equal(panel.matches({ fuelLevel: 60, engineStatus: 'off' }), false, 'status not selected');
  assert.equal(panel.matches({ fuelLevel: null, engineStatus: null }), true, 'allows missing data');
});
