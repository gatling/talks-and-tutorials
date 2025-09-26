const mqtt = require('mqtt');
const { validateTelemetry } = require('../utils/validation');
const { recordTimestamp } = require('../utils/message-metrics');

function createMqttService({ config, logger, vehicleStore, websocketService, state }) {
  const { broker, subscriptionTopic, messageWindowMs } = config;

  const mqttOptions = {
    protocol: broker.useTls ? 'mqtts' : 'mqtt',
    host: broker.host,
    port: broker.port,
    keepalive: 30
  };

  if (broker.username) {
    mqttOptions.username = broker.username;
  }

  if (broker.password) {
    mqttOptions.password = broker.password;
  }

  if (broker.useTls) {
    mqttOptions.rejectUnauthorized = broker.rejectUnauthorized;
  }

  if (broker.clientId) {
    mqttOptions.clientId = broker.clientId;
  }

  const mqttClient = mqtt.connect(mqttOptions);

  mqttClient.on('connect', () => {
    state.mqttConnected = true;
    logger.info({
      host: broker.host,
      port: broker.port,
      protocol: mqttOptions.protocol,
      username: broker.username ? '[configured]' : undefined,
      subscriptionTopic
    }, 'Connected to broker');

    mqttClient.subscribe(subscriptionTopic, err => {
      if (err) {
        logger.error({ err }, 'Subscription failed');
        process.exit(1);
      }
      logger.info({ topic: subscriptionTopic }, 'Subscription complete');
    });
  });

  mqttClient.on('reconnect', () => {
    logger.warn('Reconnecting to MQTT broker');
  });

  mqttClient.on('close', () => {
    state.mqttConnected = false;
    logger.warn('MQTT connection closed');
  });

  mqttClient.on('error', err => {
    logger.error({ err }, 'MQTT error');
  });

  mqttClient.on('message', (receivedTopic, payload) => {
    const raw = payload.toString();
    const parsed = tryParseJson(raw);
    if (!parsed.ok) {
      state.invalidMessages += 1;
      logger.warn({ topic: receivedTopic, raw, error: parsed.error }, 'Invalid telemetry payload');
      return;
    }

    const validation = validateTelemetry(parsed.value);
    if (!validation.ok) {
      state.invalidMessages += 1;
      logger.warn({ topic: receivedTopic, raw, error: validation.error }, 'Telemetry validation failed');
      return;
    }

    const message = validation.value;
    const previous = vehicleStore.get(message.vehicleId);
    const speed = previous ? computeSpeed(previous, message) : 0;
    const enriched = {
      vehicleId: message.vehicleId,
      lat: message.lat,
      lng: message.lng,
      ts: message.ts,
      speed,
      fuelLevel: message.fuelLevel,
      engineStatus: message.engineStatus,
      lastSeen: new Date().toISOString()
    };

    vehicleStore.set(message.vehicleId, enriched);
    state.totalMessages += 1;
    recordTimestamp(state, Date.now(), messageWindowMs);

    websocketService.broadcastUpdate(enriched);
    logger.debug({ topic: receivedTopic, vehicleId: message.vehicleId }, 'Processed telemetry');
  });

  function disconnect(callback) {
    mqttClient.end(false, callback);
  }

  return {
    client: mqttClient,
    disconnect
  };
}

function tryParseJson(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: 'invalid_json' };
  }
}

function computeSpeed(previous, current) {
  const prevTime = Date.parse(previous.ts);
  const currTime = Date.parse(current.ts);
  if (!Number.isFinite(prevTime) || !Number.isFinite(currTime)) {
    return 0;
  }

  const deltaMs = currTime - prevTime;
  if (deltaMs <= 0) {
    return 0;
  }

  const distanceKm = haversine(previous.lat, previous.lng, current.lat, current.lng);
  const deltaHours = deltaMs / 3_600_000;
  if (deltaHours === 0) {
    return 0;
  }

  return distanceKm / deltaHours;
}

function haversine(lat1, lng1, lat2, lng2) {
  const toRad = deg => deg * (Math.PI / 180);
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = { createMqttService };
