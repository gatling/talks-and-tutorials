const { movePoint } = require('./movement-engine');
const { resolveVehicleType } = require('../presets/vehicle-types');

function createVehicleFactory({ region, rng, vehicleType, logger }) {
  if (!region) {
    throw new Error('vehicle factory requires a region');
  }
  const rand = rng || Math.random;
  const type = resolveVehicleType(vehicleType, logger);

  function createVehicles(count) {
    const results = [];
    for (let i = 0; i < count; i += 1) {
      results.push(createVehicle());
    }
    return results;
  }

  function createVehicle() {
    const vehicleId = generateVehicleId(region.slug, rand);
    const home = pickStartingPoint(region, rand);
    const heading = rand() * 360;
    const cruiseSpeedKmh = randomBetween(type.cruiseSpeedKmh, rand);

    return {
      vehicleId,
      lat: home.lat,
      lng: home.lng,
      heading,
      speedKmh: cruiseSpeedKmh,
      cruiseSpeedKmh,
      maxSpeedKmh: randomBetween(type.maxSpeedKmh, rand),
      fuelLevel: randomBetween(type.fuelLevel, rand),
      engineStatus: 'running',
      maxRadiusKm: region.radiusKm * randomBetween(type.radiusMultiplier, rand),
      home,
      lastUpdateMs: Date.now(),
      reported: false
    };
  }

  return {
    createVehicles,
    createVehicle,
    vehicleType: type
  };
}

function generateVehicleId(prefix, rand) {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet.charAt(Math.floor(rand() * alphabet.length));
  }
  return `${prefix}-${suffix}`;
}

function pickStartingPoint(regionInfo, rand) {
  const distanceKm = rand() * regionInfo.radiusKm;
  const bearing = rand() * 360;
  return movePoint(regionInfo.lat, regionInfo.lng, bearing, distanceKm);
}

function randomBetween([min, max], rand) {
  if (min === max) {
    return min;
  }
  return min + rand() * (max - min);
}

module.exports = {
  createVehicleFactory,
  generateVehicleId,
  pickStartingPoint,
  randomBetween
};
