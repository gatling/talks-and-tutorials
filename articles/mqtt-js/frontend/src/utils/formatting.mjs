const DEFAULT_CACHE_SIZE = 200;

export function escapeHtml(input) {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function normaliseFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normaliseStatus(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const result = value.trim().toLowerCase();
  return result.length > 0 ? result : null;
}

export function createMemoizedFormatter(formatter, { maxSize = DEFAULT_CACHE_SIZE } = {}) {
  const cache = new Map();
  const nullKey = Symbol('null');
  return value => {
    const key = value == null ? nullKey : value;
    if (cache.has(key)) {
      return cache.get(key);
    }
    const formatted = formatter(value);
    cache.set(key, formatted);
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    return formatted;
  };
}

const speedFormatter = createMemoizedFormatter(value => `${value.toFixed(1)} km/h`);
const fuelFormatter = createMemoizedFormatter(value => `${value.toFixed(1)}%`);
const engineFormatter = createMemoizedFormatter(value => {
  const capitalised = value.charAt(0).toUpperCase() + value.slice(1);
  return escapeHtml(capitalised);
});

export function formatSpeed(speed) {
  if (!Number.isFinite(speed)) {
    return 'n/a';
  }
  return speedFormatter(speed);
}

export function formatFuelLevel(level) {
  if (!Number.isFinite(level)) {
    return 'n/a';
  }
  return fuelFormatter(level);
}

export function formatEngineStatus(status) {
  const normalised = normaliseStatus(status);
  if (!normalised) {
    return 'n/a';
  }
  return engineFormatter(normalised);
}
