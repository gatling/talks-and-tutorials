const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// HTTP server for serving static files
const server = http.createServer((req, res) => {
  const reqPath = req.url === '/' ? '/index.html' : decodeURIComponent(req.url);
  const filePath = path.join(__dirname, 'public', reqPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('File not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(content);
  });
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  const timers = new Set();

  // Clean up timers when connection closes
  const cleanup = () => {
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
  };

  ws.on('close', cleanup);
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    cleanup();
  });

  ws.on('message', (data) => {
    const message = data.toString();
    
    // Handle close command
    if (message.trim().toLowerCase() === 'close') {
      cleanup();
      ws.close();
      return;
    }

    // Echo back with random delay (0-5 seconds)
    const reply = `PARROT: "${message}"`;
    const delay = Math.random() * 5000;
    
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(reply);
      }
    }, delay);
    
    timers.add(timer);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});