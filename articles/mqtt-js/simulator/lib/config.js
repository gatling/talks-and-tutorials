const path = require('node:path');
const dotenv = require('dotenv');
const pino = require('pino');

const DEFAULTS = {
  host: 'localhost',
  port: 1883,
  username: undefined,
  password: undefined,
  tls: false,
  rejectUnauthorized: true,
  topic: 'fleet/demo/telemetry',
  qos: 0,
  vehicles: 1,
  maxMessages: 0,
  rate: 1000,
  jitter: 0,
  region: 'paris',
  vehicleType: 'standard',
  seed: undefined,
  logLevel: 'info'
};

const ENV_ALIASES = {
  host: ['SIM_HOST', 'BROKER_HOST'],
  port: ['SIM_PORT', 'BROKER_PORT'],
  username: ['SIM_USERNAME', 'BROKER_USERNAME'],
  password: ['SIM_PASSWORD', 'BROKER_PASSWORD'],
  tls: ['SIM_TLS', 'BROKER_TLS'],
  rejectUnauthorized: ['SIM_TLS_REJECT_UNAUTHORIZED', 'BROKER_TLS_REJECT_UNAUTHORIZED'],
  topic: ['SIM_TOPIC'],
  qos: ['SIM_QOS'],
  vehicles: ['SIM_VEHICLES'],
  maxMessages: ['SIM_MAX_MESSAGES'],
  rate: ['SIM_RATE'],
  jitter: ['SIM_JITTER'],
  region: ['SIM_REGION'],
  vehicleType: ['SIM_VEHICLE_TYPE'],
  seed: ['SIM_SEED'],
  logLevel: ['SIM_LOG_LEVEL', 'LOG_LEVEL']
};

const CLI_KEY_ALIASES = {
  'max-messages': 'maxMessages',
  'reject-unauthorized': 'rejectUnauthorized',
  'vehicle-type': 'vehicleType',
  'log-level': 'logLevel'
};

const HELP_TEXT = `Usage: simulator [options]\n\n` +
  `Options:\n` +
  `  --host <hostname>        MQTT broker host (default: localhost)\n` +
  `  --port <number>          MQTT broker port (default: 1883)\n` +
  `  --username <value>       MQTT username (default: none)\n` +
  `  --password <value>       MQTT password (default: none)\n` +
  `  --tls <true|false>       Enable TLS (default: false)\n` +
  `  --reject-unauthorized <true|false>  Reject invalid TLS certs (default: true)\n` +
  `  --topic <topic>          Telemetry topic (default: fleet/demo/telemetry)\n` +
  `  --qos <0|1|2>            Publish QoS level (default: 0)\n` +
  `  --vehicles <number>      Number of vehicles to simulate (default: 1)\n` +
  `  --max-messages <number>  Stop after publishing this many messages (default: unlimited)\n` +
  `  --rate <duration>        Base publish interval, accepts ms|s|m (default: 1s)\n` +
  `  --jitter <duration>      Publish jitter window (default: 0ms)\n` +
  `  --region <name>          Region label for generated vehicles (default: paris)\n` +
  `  --vehicle-type <name>    Vehicle behaviour preset (default: standard)\n` +
  `  --seed <value>           Optional seed for deterministic behaviour\n` +
  `  --log-level <level>      Log level (default: info)\n` +
  `  --help                   Show this message\n` +
  `\nEnvironment variables (take lower precedence than CLI):\n` +
  `  BROKER_HOST, BROKER_PORT, BROKER_USERNAME, BROKER_PASSWORD, BROKER_TLS,\n` +
  `  BROKER_TLS_REJECT_UNAUTHORIZED, SIM_TOPIC, SIM_QOS, SIM_VEHICLES,\n` +
  `  SIM_MAX_MESSAGES, SIM_RATE, SIM_JITTER, SIM_REGION, SIM_VEHICLE_TYPE, SIM_SEED,\n` +
  `  SIM_HOST, SIM_PORT, SIM_USERNAME, SIM_PASSWORD, SIM_TLS, SIM_TLS_REJECT_UNAUTHORIZED,\n` +
  `  SIM_LOG_LEVEL`;

function loadConfig({ argv = [], env = process.env, cwd = process.cwd() } = {}) {
  const envPath = path.resolve(cwd, '.env');
  const dotenvResult = dotenv.config({ path: envPath });
  if (dotenvResult.error && dotenvResult.error.code !== 'ENOENT') {
    throw new Error(`failed to load environment variables from .env: ${dotenvResult.error.message}`);
  }

  const cliValues = parseCli(argv);
  const config = buildConfig(cliValues, env);

  const logger = pino({
    name: 'simulator',
    level: config.logLevel || 'info'
  });

  const rng = createRng(config.seed);

  return {
    config,
    logger,
    rng
  };
}

function buildConfig(cliValues, env) {
  const result = {};

  for (const key of Object.keys(DEFAULTS)) {
    const rawValue = pickConfigValue(cliValues[key], key, env);
    try {
      result[key] = applyParser(key, rawValue);
    } catch (err) {
      err.message = err.message || `invalid value for ${key}`;
      throw err;
    }
  }

  return result;
}

function pickConfigValue(cliValue, key, env) {
  if (cliValue !== undefined) {
    if (typeof cliValue === 'boolean') {
      throw new Error(`flag "--${key}" requires a value`);
    }
    return cliValue;
  }

  const envNames = ENV_ALIASES[key] || [];
  for (const name of envNames) {
    if (env[name] !== undefined) {
      return env[name];
    }
  }

  return DEFAULTS[key];
}

function applyParser(key, value) {
  switch (key) {
    case 'host':
    case 'topic':
    case 'region':
    case 'vehicleType':
    case 'seed':
    case 'logLevel':
      return value === undefined ? undefined : String(value);
    case 'port':
      return coerceInteger('port', value, { min: 1, max: 65535 });
    case 'qos':
      return coerceInteger('qos', value, { min: 0, max: 2 });
    case 'vehicles':
      return coerceInteger('vehicles', value, { min: 1 });
    case 'maxMessages':
      return coerceInteger('maxMessages', value, { min: 0 });
    case 'rate':
    case 'jitter':
      return coerceDuration(key, value);
    case 'username':
    case 'password':
      return value === undefined ? undefined : String(value);
    case 'tls':
    case 'rejectUnauthorized':
      return parseBoolean(value, DEFAULTS[key]);
    default:
      return value;
  }
}

function coerceInteger(name, value, { min, max } = {}) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid ${name} value: "${value}"`);
  }
  if (min !== undefined && parsed < min) {
    throw new Error(`${name} must be >= ${min}`);
  }
  if (max !== undefined && parsed > max) {
    throw new Error(`${name} must be <= ${max}`);
  }
  return parsed;
}

function coerceDuration(name, value) {
  if (typeof value === 'number') {
    return value;
  }

  const raw = String(value).trim().toLowerCase();

  if (raw.endsWith('ms')) {
    return coerceInteger(name, raw.slice(0, -2), { min: 0 });
  }

  if (raw.endsWith('s')) {
    const seconds = coerceInteger(name, raw.slice(0, -1), { min: 0 });
    return seconds * 1000;
  }

  if (raw.endsWith('m')) {
    const minutes = coerceInteger(name, raw.slice(0, -1), { min: 0 });
    return minutes * 60_000;
  }

  return coerceInteger(name, raw, { min: 0 });
}

function parseCli(tokens) {
  const values = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];

    if (!token.startsWith('--')) {
      continue;
    }

    const trimmed = token.slice(2);
    if (!trimmed) {
      continue;
    }

    if (trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const normalizedKey = normalizeCliKey(key);
      values[normalizedKey] = rest.join('=');
      continue;
    }

    const next = tokens[i + 1];
    if (!next || next.startsWith('--')) {
      const normalizedKey = normalizeCliKey(trimmed);
      values[normalizedKey] = true;
      continue;
    }

    const normalizedKey = normalizeCliKey(trimmed);
    values[normalizedKey] = next;
    i += 1;
  }

  return values;
}

function normalizeCliKey(key) {
  return CLI_KEY_ALIASES[key] || key;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
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

function createRng(seed) {
  if (seed === undefined) {
    return Math.random;
  }

  const seedString = String(seed);
  let state = 2166136261;
  for (let i = 0; i < seedString.length; i += 1) {
    state ^= seedString.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 1;
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    const result = ((state ^ (state >>> 14)) >>> 0) / 4294967296;
    return result;
  };
}

module.exports = {
  loadConfig,
  DEFAULTS,
  HELP_TEXT,
  parseCli,
  createRng
};
