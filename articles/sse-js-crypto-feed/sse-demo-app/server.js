import express from 'express';
import { cryptoSymbols, generateInitialPrices, simulatePriceChange } from './priceGenerator.js';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

// Static frontend
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'public')));

const clients = [];
let prices = generateInitialPrices();
let eventId = 0;

app.get('/prices', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Tell clients how long to wait before retrying
  res.write(`retry: 10000\n\n`);

  const clientId = Date.now();
  const symbolsParam = req.query.symbols;
  const symbols = symbolsParam
    ? symbolsParam.split(',').filter((s) => cryptoSymbols.includes(s))
    : cryptoSymbols;
  const client = { id: clientId, res, symbols };
  clients.push(client);

  // Send initial snapshot of subscribed symbols
  const snapshot = symbols.map((s) => ({
    symbol: s,
    price: parseFloat(prices[s].toFixed(2)),
  }));
  res.write(`id: ${eventId++}\n`);
  res.write('event: snapshot\n');
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);

  console.log(`Client connected: ${clientId} (total: ${clients.length})`);

  req.on('close', () => {
    clients.splice(clients.indexOf(client), 1);
    console.log(`Client disconnected: ${clientId} (total: ${clients.length})`);
  });
});

function broadcastPrices() {
  for (const symbol of cryptoSymbols) {
    prices[symbol] = simulatePriceChange(prices[symbol]);

    const update = {
      symbol,
      price: parseFloat(prices[symbol].toFixed(2)),
    };

    const message = `id: ${eventId++}\nevent: price-update\n` +
      `data: ${JSON.stringify(update)}\n\n`;

    clients.forEach((client) => {
      if (client.symbols.includes(symbol)) {
        client.res.write(message);
      }
    });
  }
}

// Heartbeat comments to keep connections alive
setInterval(() => {
  clients.forEach((c) => c.res.write(':heartbeat\n\n'));
}, 10000);

setInterval(broadcastPrices, 2000);

app.listen(port, () => {
  console.log(`✅ SSE Crypto Price Server running at http://localhost:${port}`);
  console.log(`👉 Visit http://localhost:${port}/index.html to see the live feed`);
});
