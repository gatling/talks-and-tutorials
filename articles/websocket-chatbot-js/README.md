# Chatbot WebSocket Demo

This project provides a minimal WebSocket server and a React + Tailwind CSS client. It can be used to experiment with WebSocket connections for a chatbot-style application or to run load tests with Gatling.

## Features

- Node.js server with a handcrafted WebSocket implementation.
- React frontend styled with Tailwind CSS and a simple SaaS look for **Acme Healthcare**.
- Gatling load test examples in JavaScript and TypeScript.
- Docker and ngrok setup for exposing the server to the internet, for remote load testing with Gatling Enterprise Edition.

## Running the Server

```bash
node server.js
```

Open your browser to `http://localhost:3000` and chat with the bot. Messages are echoed back with an "AI" prefix.

To gracefully end a session, send the message `close` and the server will close the WebSocket connection.

## Running a load test locally

To simulate thousands of concurrent connections using [Gatling](https://gatling.io/). Point the WebSocket scenario at `ws://localhost:3000` and configure the desired number of virtual users. There is a companion sample load test available [WebSockets JS load test](https://github.com/stb13579/WebSocketTestJS).


## Running a load test remotely

To test the WebSocket server from a remote location, you can use the included Docker and ngrok setup to expose the server to the internet. This is useful for load testing with Gatling Enterprise Edition. First, expose the server using Docker and ngrok as described below. Then, configure your Gatling scenario to point to the ngrok URL.

### Application setup with Docker and ngrok

This repository includes a `Dockerfile` and `docker-compose.yml` to expose the server through [ngrok](https://ngrok.com) for remote load testing.

1. Create an ngrok account and obtain an auth token.
2. Copy `.env.example` to `.env` and add your token: `NGROK_AUTHTOKEN=<token>`.
3. Start the stack:

```bash
docker compose up --build
```

The ngrok service will print a forwarding URL such as `https://XXXX.ngrok-free.app`. Use this URL in your remote load testing tool to target the WebSocket server.

### Gatling Enterprise Edition setup
1. Log in to your Gatling Enterprise Edition account.
2. Create a new simulation and configure it to use the ngrok URL as the WebSocket endpoint.
3. Run your load test and analyze the results in the Gatling dashboard.
4. Monitor the server logs in the Docker container to see incoming connections and messages.