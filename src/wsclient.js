let WebSocket;
if (typeof window !== 'undefined') {
  ({ WebSocket } = window);
} else {
  WebSocket = require('ws'); // eslint-disable-line global-require
}

const wait = (ws, cb) => {
  setTimeout(() => {
    if (ws.readyState === 1) {
      if (cb !== null) cb();
    } else {
      wait(ws, cb);
    }
  }, 5);
};

export default class WSClient {
  constructor(address, reconnect) {
    this.address = address;
    this.open = false;
    this.shouldClose = false;
    this.queue = {};
    this.notifications = () => { };
    this.connect = () => {
      const ws = new WebSocket(address);

      ws.addEventListener('message', data => {
        const message = JSON.parse(data.data);
        if (this.queue[message[1].tag]) {
          const error = message[1].response ? message[1].response.error || null : null;
          const result = error ? null : message[1].response || null;
          this.queue[message[1].tag](error, result);
        } else {
          this.notifications(null, message);
        }
      });

      ws.addEventListener('open', () => {
        if (this.shouldClose) {
          this.ws.close();
          this.shouldClose = false;
        } else {
          this.open = true;
        }
      });

      ws.addEventListener('close', () => {
        this.open = false;
        if (reconnect) {
          this.ws = null;
          setTimeout(() => {
            this.connect();
          }, 1000)
        }
      });

      this.ws = ws;
    }
    this.connect();
  }

  subscribe(cb) {
    this.notifications = cb;
  }

  send(message) {
    wait(this.ws, () => {
      this.ws.send(JSON.stringify(message));
    });
  }

  close() {
    if (this.ws.readyState === WebSocket.CONNECTING) {
      this.shouldClose = true;
    } else {
      this.ws.close();
    }
  }

  request(command, params, cb) {
    const request = { command };
    if (params) request.params = params;
    request.tag = Math.random()
      .toString(36)
      .substring(7);
    this.queue[request.tag] = cb;
    this.send(['request', request]);
  }

  justsaying(subject, body) {
    const justsaying = { subject };
    if (body) justsaying.body = body;
    this.send(['justsaying', justsaying]);
  }
}
