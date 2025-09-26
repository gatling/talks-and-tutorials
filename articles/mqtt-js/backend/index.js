#!/usr/bin/env node
const { config, logger } = require('./config');
const { VehicleStore } = require('./services/vehicle-store');
const { createApiServer } = require('./routes/api');
const { createWebSocketService } = require('./services/websocket-service');
const { createMqttService } = require('./services/mqtt-service');

const state = {
  mqttConnected: false,
  totalMessages: 0,
  invalidMessages: 0,
  messageTimestamps: []
};

const vehicleStore = new VehicleStore({
  limit: config.cacheLimit,
  ttlMs: config.vehicleTtlMs,
  logger
});

let websocketService;

const httpServer = createApiServer({
  config,
  logger,
  state,
  vehicleStore,
  getClientCount: () => (websocketService ? websocketService.clientCount() : 0)
});

websocketService = createWebSocketService({
  server: httpServer,
  path: config.websocket.path,
  logger,
  vehicleStore,
  payloadVersion: config.websocket.payloadVersion
});

vehicleStore.setOnExpire(vehicleId => {
  websocketService.broadcastRemoval(vehicleId);
});

const mqttService = createMqttService({
  config,
  logger,
  vehicleStore,
  websocketService,
  state
});

httpServer.listen(config.httpPort, () => {
  logger.info({ port: config.httpPort }, 'HTTP server listening');
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('Shutting down backend');

  vehicleStore.stop();

  websocketService.close(() => {
    logger.info('WebSocket server closed');
  });

  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  mqttService.disconnect(() => {
    logger.info('MQTT client disconnected');
    process.exit(0);
  });

  const forceExitTimer = setTimeout(() => process.exit(0), 5000);
  if (typeof forceExitTimer.unref === 'function') {
    forceExitTimer.unref();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', err => {
  logger.error({ err }, 'Uncaught exception');
  shutdown();
});
process.on('unhandledRejection', err => {
  logger.error({ err }, 'Unhandled promise rejection');
  shutdown();
});
