const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 8765 });

function send(socket, data, i, n) {
  if (i <= n) {
    setTimeout(function() {
      const message = `${data} ${i}/${n}`;
      socket.send(message);
      console.log(`-> ${message}`);

      send(socket, data, i + 1, n);
    }, Math.floor(Math.random() * 1000));
  }
}

server.on("connection", (socket) => {
  console.log("new client connected");
  socket.send("connected");

  socket.on("message", (data) => {
    console.log(`message received: ${data}`);
    const n = 5 + Math.floor(Math.random() * 15);
    console.log(`responding with ${n} messages`);
    send(socket, data, 1, n);
  });

  socket.on("close", () => {
    console.log("client disconnected");
  });
});

console.log("listening on ws://localhost:8765");
