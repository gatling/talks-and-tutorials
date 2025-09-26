const EARTH_RADIUS_KM = 6371;

function advanceVehicle(vehicle, elapsedMs, regionInfo, rand) {
  const elapsedHours = elapsedMs / 3_600_000;
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) {
    return;
  }

  if (vehicle.engineStatus === 'running') {
    vehicle.speedKmh = clamp(vehicle.speedKmh + ((rand() - 0.5) * 12), 5, vehicle.maxSpeedKmh);
    vehicle.heading = normalizeBearing(vehicle.heading + (rand() - 0.5) * 25);

    const distanceKm = vehicle.speedKmh * elapsedHours;
    const nextPosition = movePoint(vehicle.lat, vehicle.lng, vehicle.heading, distanceKm);
    vehicle.lat = nextPosition.lat;
    vehicle.lng = nextPosition.lng;

    const fuelBurn = Math.max(0.05, distanceKm * 0.3);
    vehicle.fuelLevel = Math.max(0, vehicle.fuelLevel - fuelBurn);

    if (rand() < 0.07) {
      vehicle.engineStatus = 'idle';
      vehicle.speedKmh = 0;
    } else if (vehicle.fuelLevel <= 2) {
      vehicle.engineStatus = 'off';
      vehicle.speedKmh = 0;
    }
  } else if (vehicle.engineStatus === 'idle') {
    const idleDrain = elapsedHours * 1.2;
    vehicle.fuelLevel = Math.max(0, vehicle.fuelLevel - idleDrain);
    vehicle.speedKmh = 0;

    if (vehicle.fuelLevel <= 1) {
      vehicle.engineStatus = 'off';
    } else if (rand() < 0.45) {
      vehicle.engineStatus = 'running';
      vehicle.speedKmh = clamp(
        vehicle.cruiseSpeedKmh + (rand() - 0.5) * 10,
        5,
        vehicle.maxSpeedKmh
      );
    }
  } else {
    if (vehicle.fuelLevel <= 1 && rand() < 0.12) {
      vehicle.fuelLevel = 70 + rand() * 25;
    }

    if (vehicle.fuelLevel > 5 && rand() < 0.5) {
      vehicle.engineStatus = 'idle';
    }

    vehicle.speedKmh = 0;
  }

  const distanceFromHome = haversine(vehicle.lat, vehicle.lng, vehicle.home.lat, vehicle.home.lng);
  if (distanceFromHome > vehicle.maxRadiusKm) {
    vehicle.heading = bearingBetween(vehicle.lat, vehicle.lng, vehicle.home.lat, vehicle.home.lng);
  }
}

function computePublishDelay(baseRate, jitter, rand) {
  if (jitter <= 0) {
    return baseRate;
  }
  const offset = (rand() * 2 - 1) * jitter;
  return Math.max(50, Math.round(baseRate + offset));
}

function movePoint(lat, lng, bearingDeg, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearingRad = toRadians(bearingDeg);
  const latRad = toRadians(lat);
  const lngRad = toRadians(lng);

  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  const sinAD = Math.sin(angularDistance);
  const cosAD = Math.cos(angularDistance);

  const newLat = Math.asin(sinLat * cosAD + cosLat * sinAD * Math.cos(bearingRad));
  const newLng = lngRad + Math.atan2(
    Math.sin(bearingRad) * sinAD * cosLat,
    cosAD - sinLat * Math.sin(newLat)
  );

  return {
    lat: toDegrees(newLat),
    lng: normalizeLongitude(toDegrees(newLng))
  };
}

function haversine(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function bearingBetween(lat1, lng1, lat2, lng2) {
  const dLng = toRadians(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRadians(lat2));
  const x = Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(dLng);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

function normalizeLongitude(value) {
  let result = value;
  while (result < -180) {
    result += 360;
  }
  while (result > 180) {
    result -= 360;
  }
  return result;
}

function normalizeBearing(value) {
  let result = value % 360;
  if (result < 0) {
    result += 360;
  }
  return result;
}

function toRadians(value) {
  return value * (Math.PI / 180);
}

function toDegrees(value) {
  return value * (180 / Math.PI);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

module.exports = {
  advanceVehicle,
  computePublishDelay,
  movePoint,
  haversine,
  bearingBetween,
  normalizeBearing,
  normalizeLongitude,
  toRadians,
  toDegrees,
  clamp,
  EARTH_RADIUS_KM
};
