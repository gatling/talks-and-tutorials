const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');

const { withNodeOptions } = require('./backend-process');
const { attachFakeMqttBridge } = require('./fake-mqtt-bridge');

const repoRoot = path.resolve(__dirname, '..');
const simulatorPath = path.resolve(repoRoot, '../simulator/index.js');
const registerPath = path.resolve(__dirname, 'register-fake-mqtt.js');

async function runSimulator(args, envOverrides = {}) {
  const child = spawn(process.execPath, [simulatorPath, ...args], {
    env: {
      ...process.env,
      NODE_OPTIONS: withNodeOptions(`--require=${registerPath}`, process.env),
      FAKE_MQTT_ROLE: 'worker',
      ...envOverrides
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  const _bridge = attachFakeMqttBridge(child);

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  const [code] = await once(child, 'exit');

  const trimmedStdout = stdout.trim();
  const logLines = trimmedStdout === '' ? [] : trimmedStdout.split(/\r?\n/);
  const jsonLogs = [];
  for (const line of logLines) {
    try {
      jsonLogs.push(JSON.parse(line));
    } catch (err) {
      // Ignore non-JSON lines. The simulator is expected to output one JSON log object per line,
      // but in the future, non-JSON lines (such as human-readable status messages or pretty-printed logs)
      // may be interleaved with the JSON output. This ensures that the log parser remains robust
      // if the log format is extended to include such lines.
    }
  }

  return {
    code,
    stdout: trimmedStdout,
    stderr: stderr.trim(),
    logLines,
    jsonLogs
  };
}

module.exports = {
  runSimulator
};
