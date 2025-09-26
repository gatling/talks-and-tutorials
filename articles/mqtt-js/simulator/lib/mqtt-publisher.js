const mqtt = require('mqtt');
const {
  advanceVehicle,
  computePublishDelay
} = require('./movement-engine');

function createSimulatorRuntime({ config, vehicles, region, logger, rng }) {
  const rand = rng || Math.random;
  const timers = new Map();
  let shuttingDown = false;
  let simulationStarted = false;
  let offlineNotified = false;
  let totalPublished = 0;
  let forceExitTimer = null;

  const clientOptions = buildClientOptions(config);
  const client = mqtt.connect(clientOptions);

  client.on('connect', () => onConnect());
  client.on('reconnect', () => logger.warn('reconnecting to MQTT broker'));
  client.on('offline', () => {
    if (!offlineNotified) {
      offlineNotified = true;
      logger.warn('broker connection offline, telemetry will buffer until reconnect');
    }
  });
  client.on('close', () => {
    if (!shuttingDown) {
      logger.warn('MQTT connection closed');
    }
  });
  client.on('error', err => {
    logger.error({ err }, 'MQTT error');
  });

  function onConnect() {
    offlineNotified = false;
    logger.info({
      host: config.host,
      port: config.port,
      topic: config.topic,
      qos: config.qos,
      vehicles: vehicles.length,
      rateMs: config.rate,
      jitterMs: config.jitter,
      region: region.slug,
      seed: config.seed ?? null,
      protocol: clientOptions.protocol,
      username: config.username ? '[configured]' : undefined,
      tls: config.tls,
      rejectUnauthorized: config.tls ? config.rejectUnauthorized : undefined
    }, 'connected');

    if (!simulationStarted) {
      simulationStarted = true;
      startSimulation();
    }
  }

  function startSimulation() {
    logger.info({
      vehicles: vehicles.length,
      region: region.slug,
      radiusKm: region.radiusKm
    }, 'starting simulation');

    for (const vehicle of vehicles) {
      scheduleNextPublish(vehicle);
    }
  }

  function scheduleNextPublish(vehicle) {
    if (shuttingDown || (config.maxMessages > 0 && totalPublished >= config.maxMessages)) {
      return;
    }
    const delayMs = computePublishDelay(config.rate, config.jitter, rand);
    const timer = setTimeout(() => publishTelemetry(vehicle), delayMs);
    timers.set(vehicle.vehicleId, timer);
  }

  function publishTelemetry(vehicle) {
    if (shuttingDown) {
      return;
    }

    timers.delete(vehicle.vehicleId);

    const now = Date.now();
    const elapsedMs = vehicle.lastUpdateMs ? now - vehicle.lastUpdateMs : config.rate;
    advanceVehicle(vehicle, elapsedMs, region, rand);
    vehicle.lastUpdateMs = now;

    const payload = {
      vehicleId: vehicle.vehicleId,
      lat: Number(vehicle.lat.toFixed(6)),
      lng: Number(vehicle.lng.toFixed(6)),
      ts: new Date(now).toISOString(),
      fuelLevel: Number(vehicle.fuelLevel.toFixed(2)),
      engineStatus: vehicle.engineStatus
    };

    const message = JSON.stringify(payload);
    client.publish(config.topic, message, { qos: config.qos }, err => {
      if (err) {
        logger.error({ err, vehicleId: vehicle.vehicleId }, 'publish failed');
        scheduleNextPublish(vehicle);
        return;
      }

      if (shuttingDown) {
        return;
      }

      if (!vehicle.reported) {
        vehicle.reported = true;
        logger.info({ vehicleId: vehicle.vehicleId, payload }, 'first publish');
      }

      totalPublished += 1;

      if (config.maxMessages > 0 && totalPublished >= config.maxMessages) {
        logger.info({ maxMessages: config.maxMessages }, 'max messages reached, initiating shutdown');
        initiateShutdown('max_messages');
        return;
      }

      scheduleNextPublish(vehicle);
    });
  }

  function initiateShutdown(reason) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ reason }, 'shutting down');

    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();

    client.end(false, () => {
      logger.info('disconnected from broker');
      process.exit(0);
    });

    forceExitTimer = setTimeout(() => {
      logger.warn('force exiting after timeout');
      process.exit(1);
    }, 5000);
    if (typeof forceExitTimer.unref === 'function') {
      forceExitTimer.unref();
    }
  }

  function disposeTimers() {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  return {
    start: () => client,
    initiateShutdown,
    getTotalPublished: () => totalPublished,
    disposeTimers,
    client,
    timers,
    state: () => ({ shuttingDown, simulationStarted, offlineNotified })
  };
}

function buildClientOptions(config) {
  const options = {
    protocol: config.tls ? 'mqtts' : 'mqtt',
    host: config.host,
    port: config.port,
    reconnectPeriod: 5000,
    connectTimeout: 30_000,
    keepalive: 30,
    queueQoSZero: true
  };

  if (config.username) {
    options.username = config.username;
  }

  if (config.password) {
    options.password = config.password;
  }

  if (config.tls) {
    options.rejectUnauthorized = config.rejectUnauthorized;
  }

  return options;
}

module.exports = {
  createSimulatorRuntime
};
