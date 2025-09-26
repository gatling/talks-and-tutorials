class VehicleStore {
  constructor({ limit, ttlMs = 0, logger, onExpire } = {}) {
    this.limit = Number.isFinite(limit) && limit > 0 ? limit : 1000;
    this.ttlMs = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 0;
    this.logger = logger;
    this.onExpire = typeof onExpire === 'function' ? onExpire : null;
    this.map = new Map();
    this.expiryTimer = null;

    if (this.ttlMs > 0) {
      const intervalMs = Math.max(1000, Math.min(this.ttlMs, 15_000));
      this.expiryTimer = setInterval(() => this.pruneExpired(), intervalMs);
      if (typeof this.expiryTimer.unref === 'function') {
        this.expiryTimer.unref();
      }
      this.logger?.info({ vehicleTtlMs: this.ttlMs, intervalMs }, 'Vehicle TTL enforcement enabled');
    } else {
      this.logger?.info('Vehicle TTL enforcement disabled');
    }
  }

  setOnExpire(handler) {
    this.onExpire = typeof handler === 'function' ? handler : null;
  }

  get(id) {
    return this.map.get(id);
  }

  set(id, value) {
    if (this.map.has(id)) {
      this.map.delete(id);
    }
    this.map.set(id, value);

    if (this.map.size > this.limit) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
        this.logger?.debug({ vehicleId: oldestKey }, 'Evicted vehicle due to cache limit');
      }
    }
  }

  delete(id) {
    this.map.delete(id);
  }

  size() {
    return this.map.size;
  }

  values() {
    return this.map.values();
  }

  entries() {
    return this.map.entries();
  }

  pruneExpired(now = Date.now()) {
    if (this.ttlMs <= 0) {
      return;
    }

    const expiredIds = [];
    for (const [vehicleId, vehicle] of this.map.entries()) {
      const lastSeen = Date.parse(vehicle?.lastSeen);
      if (!Number.isFinite(lastSeen)) {
        continue;
      }
      if (now - lastSeen >= this.ttlMs) {
        expiredIds.push(vehicleId);
      }
    }

    for (const vehicleId of expiredIds) {
      const vehicle = this.map.get(vehicleId);
      this.map.delete(vehicleId);
      this.logger?.debug({ vehicleId }, 'Vehicle expired due to TTL and was removed');
      if (this.onExpire) {
        try {
          this.onExpire(vehicleId, vehicle);
        } catch (err) {
          this.logger?.warn({ err, vehicleId }, 'Vehicle expire handler threw error');
        }
      }
    }
  }

  stop() {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}

module.exports = { VehicleStore };
