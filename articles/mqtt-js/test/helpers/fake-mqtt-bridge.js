const { EventEmitter } = require('node:events');

require('./register-fake-mqtt');
const mqtt = require('mqtt');

class RemoteMqttBridge {
  constructor(childProcess) {
    this.child = childProcess;
    this.client = new EventEmitter();
    this.client.subscriptions = new Set();
    this.handleMessage = this.handleMessage.bind(this);

    this.attachMessageRelay();

    this.child.on('message', this.handleMessage);
    this.child.once('exit', () => {
      mqtt.__broker.unregister(this.client);
      this.child.off('message', this.handleMessage);
    });
  }

  attachMessageRelay() {
    this.client.removeAllListeners('message');
    this.client.on('message', (topic, payload) => {
      this.send({
        type: 'mqtt_message',
        topic,
        payload: Buffer.from(payload).toString('base64'),
        encoding: 'base64'
      });
    });
  }

  handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    switch (message.type) {
      case 'mqtt_connect':
        mqtt.__broker.register(this.client);
        this.send({ type: 'mqtt_connected' });
        break;
      case 'mqtt_subscribe':
        for (const topic of message.topics || []) {
          this.client.subscriptions.add(topic);
        }
        this.send({ type: 'mqtt_subscribed', granted: [...this.client.subscriptions] });
        break;
      case 'mqtt_publish': {
        const payload = Buffer.from(message.payload || '', message.encoding || 'utf8');
        mqtt.__broker.publish(this.client, message.topic, payload);
        break;
      }
      case 'mqtt_end':
        mqtt.__broker.unregister(this.client);
        this.send({ type: 'mqtt_closed' });
        break;
      case 'mqtt_reset':
        mqtt.__broker.unregister(this.client);
        this.attachMessageRelay();
        mqtt.__broker.register(this.client);
        break;
      default:
        break;
    }
  }

  send(data) {
    if (this.child.connected) {
      this.child.send(data);
    }
  }
}

function attachFakeMqttBridge(childProcess) {
  return new RemoteMqttBridge(childProcess);
}

module.exports = {
  attachFakeMqttBridge
};
