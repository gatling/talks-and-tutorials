const { EventEmitter } = require('node:events');

class FakeBroker {
  constructor() {
    this.clients = new Set();
  }

  register(client) {
    this.clients.add(client);
  }

  unregister(client) {
    this.clients.delete(client);
  }

  publish(fromClient, topic, message) {
    const buffer = Buffer.isBuffer(message) ? message : Buffer.from(String(message));
    for (const client of this.clients) {
      for (const pattern of client.subscriptions) {
        if (topicMatches(pattern, topic)) {
          client.emit('message', topic, buffer);
        }
      }
    }
  }

  reset() {
    for (const client of this.clients) {
      client.removeAllListeners();
    }
    this.clients.clear();
  }
}

class FakeMqttClient extends EventEmitter {
  constructor(broker, options = {}) {
    super();
    this.broker = broker;
    this.options = options;
    this.subscriptions = new Set();
    this.connected = false;
    this.ending = false;
    this.broker.register(this);
    process.nextTick(() => {
      if (!this.ending) {
        this.connected = true;
        this.emit('connect');
      }
    });
  }

  publish(topic, message, opts = {}, callback) {
    process.nextTick(() => {
      this.broker.publish(this, topic, message);
      if (typeof callback === 'function') {
        callback(null);
      }
    });
  }

  subscribe(topic, callback) {
    const topics = Array.isArray(topic) ? topic : [topic];
    for (const entry of topics) {
      if (entry && typeof entry.topic === 'string') {
        this.subscriptions.add(entry.topic);
      } else if (typeof entry === 'string') {
        this.subscriptions.add(entry);
      }
    }
    process.nextTick(() => {
      if (typeof callback === 'function') {
        callback(null, topics.map(t => ({
          topic: typeof t === 'string' ? t : t.topic,
          qos: 0
        })));
      }
    });
  }

  end(force = false, callback) {
    this.ending = true;
    process.nextTick(() => {
      this.broker.unregister(this);
      this.connected = false;
      this.emit('close');
      if (typeof callback === 'function') {
        callback();
      }
    });
  }
}

function topicMatches(pattern, topic) {
  if (pattern === '#') {
    return true;
  }

  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < patternParts.length; i += 1) {
    const part = patternParts[i];
    const value = topicParts[i];

    if (part === '#') {
      return true;
    }

    if (part === '+') {
      if (value === undefined) {
        return false;
      }
      continue;
    }

    if (value === undefined || part !== value) {
      return false;
    }
  }

  return patternParts.length === topicParts.length;
}

const broker = new FakeBroker();

module.exports = {
  connect(options = {}) {
    return new FakeMqttClient(broker, options);
  },
  __reset() {
    broker.reset();
  },
  __broker: broker
};
