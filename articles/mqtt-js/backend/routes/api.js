const http = require('node:http');
const { URL } = require('node:url');
const { applyCors } = require('../middleware/cors');
const { handleRequestError } = require('../middleware/error-handler');
const { calculateRate } = require('../utils/message-metrics');

function createApiServer({ config, logger, state, vehicleStore, getClientCount }) {
  const server = http.createServer((req, res) => {
    try {
      if (applyCors(req, res)) {
        return;
      }

      const method = (req.method || 'GET').toUpperCase();
      if (method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET,OPTIONS');
        return sendJson(res, { error: 'Method not allowed' });
      }

      let pathname = '/';
      try {
        const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        pathname = parsedUrl.pathname;
      } catch (err) {
        logger.warn({ err, url: req.url }, 'Failed to parse request URL');
      }

      switch (pathname) {
        case '/healthz':
          return sendJson(res, { status: 'ok' });
        case '/readyz':
          return sendJson(res, {
            status: state.mqttConnected ? 'ready' : 'not_ready'
          }, state.mqttConnected ? 200 : 503);
        case '/stats':
          return sendJson(res, buildStats({ config, state, vehicleStore, getClientCount }));
        default:
          res.statusCode = 404;
          return sendJson(res, { error: 'Not found' });
      }
    } catch (err) {
      handleRequestError(err, req, res, logger);
    }
  });

  server.on('clientError', (err, socket) => {
    logger.warn({ err }, 'HTTP client error');
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  });

  return server;
}

function sendJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function buildStats({ config, state, vehicleStore, getClientCount }) {
  const rate = calculateRate(state, config.messageWindowMs, Date.now());
  return {
    totalMessages: state.totalMessages,
    invalidMessages: state.invalidMessages,
    vehiclesTracked: vehicleStore.size(),
    connectedClients: typeof getClientCount === 'function' ? getClientCount() : 0,
    messageRatePerSecond: Number(rate.toFixed(3)),
    windowSeconds: config.messageWindowMs / 1000
  };
}

module.exports = { createApiServer };
