const http = require('node:http');

const originalListen = http.Server.prototype.listen;

http.Server.prototype.listen = function patchedListen(...args) {
  if (args.length === 0) {
    return originalListen.apply(this, args);
  }

  const first = args[0];

  if (typeof first === 'object' && first !== null) {
    const options = { ...first };
    if (options.host === undefined && options.hostname === undefined && options.path === undefined) {
      options.host = '127.0.0.1';
    }
    args[0] = options;
    return originalListen.apply(this, args);
  }

  if (typeof first === 'number' || typeof first === 'bigint') {
    const hostArg = args[1];
    if (typeof hostArg !== 'string' && typeof hostArg !== 'object') {
      args.splice(1, 0, '127.0.0.1');
    }
  }

  return originalListen.apply(this, args);
};
