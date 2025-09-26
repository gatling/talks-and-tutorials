const Module = require('node:module');
const path = require('node:path');

if (!process.env.FAKE_MQTT_ROLE) {
  process.env.FAKE_MQTT_ROLE = 'controller';
}

const role = process.env.FAKE_MQTT_ROLE;
const fakeMqttPath = role === 'worker' && typeof process.send === 'function'
  ? path.resolve(__dirname, 'fake-mqtt-worker.js')
  : path.resolve(__dirname, 'fake-mqtt.js');
const fakeMqtt = require(fakeMqttPath);

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'mqtt') {
    return fakeMqtt;
  }
  return originalLoad.apply(this, arguments);
};
