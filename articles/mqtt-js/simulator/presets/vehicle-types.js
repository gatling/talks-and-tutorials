const VEHICLE_TYPES = {
  standard: {
    name: 'Standard Fleet',
    cruiseSpeedKmh: [30, 70],
    maxSpeedKmh: [90, 130],
    fuelLevel: [60, 100],
    radiusMultiplier: [1.2, 1.8]
  },
  delivery: {
    name: 'Urban Delivery',
    cruiseSpeedKmh: [20, 45],
    maxSpeedKmh: [60, 100],
    fuelLevel: [40, 80],
    radiusMultiplier: [0.8, 1.2]
  },
  freight: {
    name: 'Long Haul Freight',
    cruiseSpeedKmh: [25, 55],
    maxSpeedKmh: [70, 110],
    fuelLevel: [75, 100],
    radiusMultiplier: [1.5, 2.3]
  }
};

function resolveVehicleType(name, logger) {
  if (!name) {
    return { slug: 'standard', ...VEHICLE_TYPES.standard };
  }
  const slug = String(name).toLowerCase();
  if (VEHICLE_TYPES[slug]) {
    return { slug, ...VEHICLE_TYPES[slug] };
  }
  logger?.warn({ vehicleType: name }, 'Unknown vehicle type supplied, defaulting to standard');
  return { slug: 'standard', ...VEHICLE_TYPES.standard };
}

module.exports = {
  VEHICLE_TYPES,
  resolveVehicleType
};
