# SSE JS Demo & Gatling Load Testing

This repository demonstrates a complete workflow for load testing a Server-Sent Events (SSE) application using Gatling's JavaScript/TypeScript SDK. It includes:

- **SSE Demo Application**: A Node.js service exposing SSE endpoints for real-time streaming, located in the `src/` directory.
- **Gatling JS Simulations**: Load test scripts written with the Gatling JS SDK, also in `src/`, following best practices for parameterization and protocol configuration.
- **Docker Compose Setup**: Containerized environment for running the SSE app and an `ngrok` tunnel, enabling remote access for distributed load testing.
- **Resources**: Supporting assets (CSV feeders, Postman collections) under `resources/` for use in simulations.
- **Gatling Integration**: Ready-to-run scripts and instructions for executing load tests locally or on Gatling Enterprise Edition, with environment variable support for dynamic configuration.

## 📁 Project Structure


**Purpose:**  
Showcase how to build, run, and load test a modern SSE service using Gatling JS, with a focus on reproducibility, remote testing, and best practices for test-as-code.

## 🚀 Running the Full Demo with Docker & Gatling Enterprise

To launch the SSE demo app and run Gatling JS load tests (locally or on Gatling Enterprise Edition):

### 1. Start the SSE Demo Application

Make sure Docker is installed and running. From the project root, start the containers:

```bash
docker-compose up --build
```

- **SSE app** will be available at `http://localhost:3000`.
- **ngrok tunnel** exposes the app to the public internet; the public URL appears in the ngrok container logs.

To use your own ngrok auth token (recommended for stable URLs):

```bash
NGROK_AUTHTOKEN=<your-token> docker-compose up --build
```

### 2. Prepare Gatling JS Load Tests

- Simulation files are in `src/` and end with `.gatling.js` or `.gatling.ts`.
- Assets (CSV feeders, Postman collections) are under `resources/`.

### 3. Run Load Tests Locally

You can run a simulation against the local SSE app:

```bash
npx gatling run baseUrl=http://localhost:3000 usersPerSec=2 durationSec=60
```

### 4. Run Load Tests on Gatling Enterprise Edition

1. **Package your tests:**

    ```bash
    npx gatling enterprise-package
    ```
    This creates `target/package.zip` for upload.

2. **Configure the test run:**
    - Set `baseUrl` to the ngrok public URL from the container logs (e.g., `https://<random>.ngrok.io`).
    - Adjust `usersPerSec`, `durationSec`, and any other parameters as needed.

3. **Upload and launch:**
    - In Gatling Enterprise, upload `target/package.zip`.
    - Set runtime parameters (`baseUrl`, etc.) in the UI or via environment variables.
    - Start the test and monitor results.

**Tip:**  
Always use environment variables or Gatling parameters for secrets and URLs. For remote tests, ensure the ngrok tunnel is active and reachable.



