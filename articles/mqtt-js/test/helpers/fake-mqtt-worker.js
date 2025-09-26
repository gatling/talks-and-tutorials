const { EventEmitter } = require('node:events');

if (typeof process.send !== 'function') {
  module.exports = require('./fake-mqtt');
  module.exports.__workerFallback = true;
  return;
}

class RemoteMqttClient extends EventEmitter {
  constructor() {
    super();
    this.subscriptions = new Set();
    this.connected = false;
    this.ending = false;

    this._handleMessage = this._handleMessage.bind(this);
    process.on('message', this._handleMessage);

    process.once('disconnect', () => {
      this._handleDisconnect();
    });

    process.send({ type: 'mqtt_connect' });
  }

  _handleMessage(message) {
    if (!message || typeof message !== 'object') {
      return;
    }

    switch (message.type) {
      case 'mqtt_connected':
        if (!this.connected) {
          this.connected = true;
          process.nextTick(() => this.emit('connect'));
        }
        break;
      case 'mqtt_message': {
        const payload = typeof message.payload === 'string'
          ? Buffer.from(message.payload, message.encoding || 'utf8')
          : Buffer.from([]);
        this.emit('message', message.topic, payload);
        break;
      }
      case 'mqtt_subscribed': {
        const granted = (message.granted || []).map(topic => ({ topic, qos: 0 }));
        this.emit('packetsend', { cmd: 'suback', granted });
        break;
      }
      case 'mqtt_closed':
        this._handleDisconnect();
        break;
      default:
        break;
    }
  }

  publish(topic, message, opts = {}, callback) {
    const payload = Buffer.isBuffer(message) ? message : Buffer.from(String(message));
    process.send({
      type: 'mqtt_publish',
      topic,
      payload: payload.toString('base64'),
      encoding: 'base64',
      opts
    });
    if (typeof callback === 'function') {
      process.nextTick(() => callback(null));
    }
  }

  subscribe(topic, callback) {
    const topics = Array.isArray(topic) ? topic : [topic];
    const granted = [];
    for (const entry of topics) {
      if (entry && typeof entry.topic === 'string') {
        this.subscriptions.add(entry.topic);
        granted.push(entry.topic);
      } else if (typeof entry === 'string') {
        this.subscriptions.add(entry);
        granted.push(entry);
      }
    }
    process.send({ type: 'mqtt_subscribe', topics: granted });
    if (typeof callback === 'function') {
      process.nextTick(() => callback(null, granted.map(topic => ({ topic, qos: 0 }))));
    }
  }

  end(force = false, callback) {
    if (this.ending) {
      if (typeof callback === 'function') {
        process.nextTick(callback);
      }
      return;
    }

    this.ending = true;
    process.send({ type: 'mqtt_end' });
    process.nextTick(() => {
      this._handleDisconnect();
      if (typeof callback === 'function') {
        callback();
      }
    });
  }

  _handleDisconnect() {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    process.removeListener('message', this._handleMessage);
    this.emit('close');
  }
}

module.exports = {
  connect() {
    return new RemoteMqttClient();
  },
  __reset() {
    process.send({ type: 'mqtt_reset' });
  }
};
