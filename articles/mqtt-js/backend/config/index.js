const pino = require('pino');

function envOrNull(name) {
  const value = process.env[name];
  return value === undefined || value === null || value === '' ? null : value;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

function parseNumber(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

const config = {
  logLevel: process.env.LOG_LEVEL || 'info',
  broker: {
    host: process.env.BROKER_HOST || 'localhost',
    port: parseNumber(process.env.BROKER_PORT, 1883),
    username: envOrNull('BROKER_USERNAME'),
    password: envOrNull('BROKER_PASSWORD'),
    useTls: parseBoolean(process.env.BROKER_TLS, false),
    rejectUnauthorized: parseBoolean(process.env.BROKER_TLS_REJECT_UNAUTHORIZED, true),
    clientId: envOrNull('BROKER_CLIENT_ID')
  },
  subscriptionTopic: process.env.SUB_TOPIC || 'fleet/+/telemetry',
  httpPort: parseNumber(process.env.PORT, 8080),
  cacheLimit: parseNumber(process.env.VEHICLE_CACHE_SIZE, 1000),
  messageWindowMs: parseNumber(process.env.MESSAGE_RATE_WINDOW_MS, 60_000),
  vehicleTtlMs: parseNumber(process.env.VEHICLE_TTL_MS, 60_000),
  websocket: {
    path: '/stream',
    payloadVersion: 1
  }
};

const logger = pino({ name: 'backend', level: config.logLevel });

module.exports = { config, logger };
