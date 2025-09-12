const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'DOGE', 'ADA'];

function generateInitialPrices() {
  const prices = {};
  for (const symbol of cryptoSymbols) {
    prices[symbol] = getRandomPrice();
  }
  return prices;
}

function getRandomPrice(base = 10000, variance = 1000) {
  return base + (Math.random() - 0.5) * variance * 2;
}

function simulatePriceChange(current) {
  const change = (Math.random() - 0.5) * 100;
  return Math.max(0, current + change);
}

export { cryptoSymbols, generateInitialPrices, simulatePriceChange };
