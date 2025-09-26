const WebSocket = require('ws');

const MAX_BUFFERED_BYTES = 512 * 1024;

function createWebSocketService({ server, path, logger, vehicleStore, payloadVersion }) {
  const clients = new Set();
  const wss = new WebSocket.Server({ server, path });

  function broadcastUpdate(vehicle) {
    const payload = JSON.stringify(formatVehiclePayload(vehicle, payloadVersion));
    broadcastPayload(payload);
  }

  function broadcastRemoval(vehicleId) {
    const payload = JSON.stringify({
      type: 'vehicle_remove',
      version: payloadVersion,
      vehicleId
    });
    broadcastPayload(payload);
  }

  function broadcastPayload(payload) {
    for (const socket of clients) {
      if (!sendPayload(socket, payload)) {
        clients.delete(socket);
      }
    }
  }

  function sendSnapshot(socket) {
    for (const vehicle of vehicleStore.values()) {
      const payload = JSON.stringify(formatVehiclePayload(vehicle, payloadVersion));
      if (!sendPayload(socket, payload)) {
        break;
      }
    }
  }

  function sendPayload(socket, payload) {
    if (socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
      logger.warn({ bufferedAmount: socket.bufferedAmount }, 'Dropping WebSocket payload due to backpressure');
      return false;
    }

    try {
      socket.send(payload);
      return true;
    } catch (err) {
      logger.warn({ err }, 'Failed to send WebSocket payload');
      return false;
    }
  }

  wss.on('connection', socket => {
    clients.add(socket);
    logger.info({ clients: clients.size }, 'WebSocket client connected');

    sendSnapshot(socket);

    socket.on('close', () => {
      clients.delete(socket);
      logger.info({ clients: clients.size }, 'WebSocket client disconnected');
    });

    socket.on('error', err => {
      logger.warn({ err }, 'WebSocket client error');
    });
  });

  wss.on('error', err => {
    logger.error({ err }, 'WebSocket server error');
  });

  function close(callback) {
    wss.close(callback);
  }

  function clientCount() {
    return clients.size;
  }

  return {
    broadcastUpdate,
    broadcastRemoval,
    clientCount,
    close,
    wss
  };
}

function formatVehiclePayload(vehicle, payloadVersion) {
  const telemetry = {
    timestamp: vehicle.ts,
    speed: Number.isFinite(vehicle.speed) ? Number(vehicle.speed) : null,
    fuelLevel: Number.isFinite(vehicle.fuelLevel) ? Number(vehicle.fuelLevel) : null,
    engineStatus: typeof vehicle.engineStatus === 'string' ? vehicle.engineStatus : null
  };

  return {
    type: 'vehicle_update',
    version: payloadVersion,
    vehicleId: vehicle.vehicleId,
    position: {
      lat: vehicle.lat,
      lng: vehicle.lng
    },
    telemetry,
    filters: {
      engineStatus: telemetry.engineStatus,
      fuelLevel: telemetry.fuelLevel
    },
    lastSeen: vehicle.lastSeen
  };
}

module.exports = { createWebSocketService };
