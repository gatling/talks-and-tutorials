# 🧪 Live Crypto Price Feed UI

This is a simple frontend to visualize cryptocurrency price updates via Server-Sent Events (SSE).

## 🖥️ Features

- Connects to `/prices` SSE stream.
- Displays live price updates for crypto symbols.
- Highlights price direction (green for up, red for down).
- Self-contained — no framework, no build tools.

## 📦 Requirements

- The backend SSE server must be running and expose a `/prices` endpoint that sends JSON like:
  ```json
  { "symbol": "BTC", "price": 29456.23 }
