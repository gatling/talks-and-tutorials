const ENGINE_STATUS_VALUES = new Set(['running', 'idle', 'off']);

function validateTelemetry(payload) {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, error: 'payload must be an object' };
  }

  const { vehicleId, lat, lng, ts, fuelLevel, engineStatus } = payload;

  if (typeof vehicleId !== 'string' || vehicleId.trim() === '') {
    return { ok: false, error: 'vehicleId must be a non-empty string' };
  }

  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: 'lat must be a finite number between -90 and 90' };
  }

  if (!isFiniteNumber(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: 'lng must be a finite number between -180 and 180' };
  }

  if (ts === undefined || ts === null) {
    return { ok: false, error: 'ts is required' };
  }

  const timestamp = new Date(ts);
  if (Number.isNaN(timestamp.valueOf())) {
    return { ok: false, error: 'ts must be a valid date' };
  }

  if (!isFiniteNumber(fuelLevel) || fuelLevel < 0 || fuelLevel > 100) {
    return { ok: false, error: 'fuelLevel must be a finite number between 0 and 100' };
  }

  if (typeof engineStatus !== 'string' || !ENGINE_STATUS_VALUES.has(engineStatus.toLowerCase())) {
    return { ok: false, error: 'engineStatus must be one of running|idle|off' };
  }

  return {
    ok: true,
    value: {
      vehicleId: vehicleId.trim(),
      lat: Number(lat),
      lng: Number(lng),
      ts: timestamp.toISOString(),
      fuelLevel: Number(fuelLevel),
      engineStatus: engineStatus.toLowerCase()
    }
  };
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

module.exports = { validateTelemetry, ENGINE_STATUS_VALUES };
