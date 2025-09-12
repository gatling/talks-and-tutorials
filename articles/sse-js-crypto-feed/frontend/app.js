const tableBody = document.getElementById('price-table-body');
const statusEl = document.getElementById('status');
const prices = {};

function updateTable(symbol, price) {
  const now = new Date().toLocaleTimeString();
  const rowId = `row-${symbol}`;
  const existingRow = document.getElementById(rowId);

  let priceClass = '';
  if (prices[symbol] !== undefined) {
    priceClass = price > prices[symbol] ? 'price-up' : price < prices[symbol] ? 'price-down' : '';
  }

  prices[symbol] = price;

  const html = `
    <tr id="${rowId}">
      <td>${symbol}</td>
      <td class="${priceClass}">$${price.toFixed(2)}</td>
      <td>${now}</td>
    </tr>
  `;

  if (existingRow) {
    existingRow.outerHTML = html;
  } else {
    tableBody.insertAdjacentHTML('beforeend', html);
  }
}

function connectWithRetry(delay = 1000) {
  statusEl.textContent = 'Connecting...';
  const es = new EventSource('/prices');

  es.addEventListener('snapshot', (event) => {
    try {
      const data = JSON.parse(event.data);
      data.forEach((d) => updateTable(d.symbol, d.price));
    } catch (e) {
      console.error('Invalid snapshot data:', event.data);
    }
  });

  es.addEventListener('price-update', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.symbol && data.price) {
        updateTable(data.symbol, data.price);
      }
    } catch (e) {
      console.error('Invalid event data:', event.data);
    }
  });

  es.onopen = () => {
    statusEl.textContent = 'Connected';
    delay = 1000; // reset backoff
  };

  es.onerror = () => {
    statusEl.textContent = `Disconnected. Reconnecting in ${delay / 1000}s...`;
    es.close();
    setTimeout(() => connectWithRetry(Math.min(delay * 2, 30000)), delay);
  };
}

connectWithRetry();
