#!/usr/bin/env node
const { loadConfig, HELP_TEXT } = require('./lib/config');
const { resolveRegion } = require('./presets/regions');
const { createVehicleFactory } = require('./lib/vehicle-factory');
const { createSimulatorRuntime } = require('./lib/mqtt-publisher');

const cliTokens = process.argv.slice(2);

if (cliTokens.includes('-h') || cliTokens.includes('--help')) {
  console.log(HELP_TEXT);
  process.exit(0);
}

let bundle;
try {
  bundle = loadConfig({ argv: cliTokens, cwd: process.cwd(), env: process.env });
} catch (err) {
  const message = err?.message || 'failed to load simulator configuration';
  console.error(message);
  process.exit(1);
}

const { config, logger, rng } = bundle;
const region = resolveRegion(config.region, logger);
const factory = createVehicleFactory({ region, rng, vehicleType: config.vehicleType, logger });
const vehicles = factory.createVehicles(config.vehicles);

const runtime = createSimulatorRuntime({
  config,
  vehicles,
  region,
  logger,
  rng
});

runtime.start();

process.on('SIGINT', () => runtime.initiateShutdown('SIGINT'));
process.on('SIGTERM', () => runtime.initiateShutdown('SIGTERM'));
process.on('uncaughtException', err => {
  logger.error({ err }, 'uncaught exception received');
  runtime.initiateShutdown('uncaughtException');
});
process.on('unhandledRejection', err => {
  logger.error({ err }, 'unhandled promise rejection');
  runtime.initiateShutdown('unhandledRejection');
});
