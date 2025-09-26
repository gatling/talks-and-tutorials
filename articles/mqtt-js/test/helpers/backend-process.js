const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

require('./register-fake-mqtt');
const mqtt = require('mqtt');
const { attachFakeMqttBridge } = require('./fake-mqtt-bridge');

const repoRoot = path.resolve(__dirname, '..');
const backendPath = path.resolve(repoRoot, '../backend/index.js');
const registerPath = path.resolve(__dirname, 'register-fake-mqtt.js');
const loopbackPatchPath = path.resolve(__dirname, 'patch-http-listen.js');

function withNodeOptions(extra, baseEnv = process.env) {
  const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : '';
  return `${existing}${extra}`.trim();
}

async function startBackend(t, { port = 8090, env: envOverrides = {} } = {}) {
  mqtt.__reset();
  const subscriptionTopic = envOverrides.SUB_TOPIC || 'fleet/+/telemetry';
  const child = spawn(process.execPath, [backendPath], {
    env: {
      ...process.env,
      NODE_OPTIONS: withNodeOptions(`--require=${registerPath} --require=${loopbackPatchPath}`, process.env),
      PORT: String(port),
      LOG_LEVEL: envOverrides.LOG_LEVEL || 'debug',
      BROKER_HOST: envOverrides.BROKER_HOST || 'localhost',
      BROKER_PORT: envOverrides.BROKER_PORT || '1883',
      SUB_TOPIC: envOverrides.SUB_TOPIC || 'fleet/+/telemetry',
      FAKE_MQTT_ROLE: 'worker',
      ...envOverrides
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });

  t.after(async () => {
    child.kill('SIGTERM');
    try {
      await once(child, 'exit');
    } catch (err) {
      // ignore
    }
    mqtt.__reset();
  });
  let subscriptionSeen = false;
  let stdoutBuffer = '';
  let onSubscription;
  const _bridge = attachFakeMqttBridge(child);
  const subscriptionPromise = new Promise((resolve, reject) => {
    let onError;
    let onExit;
    onSubscription = () => {
      subscriptionSeen = true;
      child.off('error', onError);
      child.off('exit', onExit);
      resolve();
    };
    onError = err => {
      if (!subscriptionSeen) {
        child.off('exit', onExit);
        reject(err);
      }
    };
    onExit = code => {
      if (!subscriptionSeen) {
        child.off('error', onError);
        reject(new Error(`process exited with code ${code}`));
      }
    };
    child.once('error', onError);
    child.once('exit', onExit);
  });

  child.stdout.on('data', chunk => {
    const text = chunk.toString();
    stdoutBuffer = `${stdoutBuffer}${text}`.slice(-2000);
    if (!subscriptionSeen && stdoutBuffer.includes('Subscription complete')) {
      onSubscription();
    }
    process.stdout.write(`[backend child] ${text}`);
  });
  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    process.stderr.write(`[backend child:err] ${text}`);
  });

  try {
    await waitForReady(child, port);
    await waitForSubscription(subscriptionPromise, subscriptionTopic);
    return { child, port };
  } catch (err) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    const [code] = child.exitCode !== null ? [child.exitCode] : await once(child, 'exit');
    throw new Error(`Backend exited before ready (code ${code}): ${err.message}`);
  }
}

async function waitForReady(child, port) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('process exited');
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (res.ok) {
        return;
      }
    } catch (err) {
      // ignore until timeout
    }
    await delay(50);
  }
  throw new Error('timed out waiting for /healthz');
}

async function waitForSubscription(subscriptionPromise, topic) {
  const timeoutMs = 5000;
  const timeoutPromise = delay(timeoutMs).then(() => {
    throw new Error(`timed out waiting for subscription to ${topic}`);
  });
  await Promise.race([subscriptionPromise, timeoutPromise]);
}

module.exports = {
  startBackend,
  withNodeOptions
};
