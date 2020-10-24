import {
  HEARTBEAT_TIMEOUT,
  HEARTBEAT_RESPONSE_TIMEOUT,
  HEARTBEAT_PAUSE_TIMEOUT,
} from './constants';

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
    this.lastTimestamp = Date.now();
    this.lastWakeTimestamp = Date.now();
    this.lastSentTimestamp = null;
    this.notifications = () => {};
    this.onConnectCallback = () => {};
    this.connect = () => {
      const ws = new WebSocket(address);

      ws.addEventListener('message', payload => {
        this.lastTimestamp = Date.now();
        const message = JSON.parse(payload.data);
        if (!message || !Array.isArray(message) || message.length !== 2) return;
        const type = message[0];
        const { tag } = message[1];
        // handle certain requests and responses
        if (type === 'request' && tag) {
          const { command } = message[1];
          if (command === 'heartbeat') {
            // true if our timers were paused
            // Happens only on android, which suspends timers when the app becomes paused but still keeps network connections
            // Handling 'pause' event would've been more straightforward but with preference KeepRunning=false, the event is delayed till resume
            if (Date.now() - this.lastWakeTimestamp > HEARTBEAT_PAUSE_TIMEOUT) {
              // opt out of receiving heartbeats and move the connection into a sleeping state
              this.respond(command, tag, 'sleep');
              return;
            }
            // response with acknowledge
            this.respond(command, tag);
            return;
            // eslint-disable-next-line no-else-return
          } else if (command === 'subscribe') {
            this.error(command, tag, "I'm light, cannot subscribe you to updates");
            return;
          } else if (command.startsWith('light/')) {
            this.error(command, tag, "I'm light myself, can't serve you");
            return;
          } else if (command.startsWith('hub/')) {
            this.error(command, tag, "I'm not a hub");
            return;
          }
        } else if (type === 'response' && tag && this.queue[tag]) {
          if (message[1].command === 'heartbeat') {
            this.lastSentTimestamp = null;
          }
        }
        // handle everything else
        if (tag && this.queue[tag]) {
          const error = message[1].response ? message[1].response.error || null : null;
          const result = error ? null : message[1].response || null;
          const callback = this.queue[tag];
          delete this.queue[tag]; // cleanup
          callback(error, result);
        } else {
          this.notifications(null, message);
        }
      });

      ws.addEventListener('open', () => {
        this.lastTimestamp = Date.now();
        if (this.shouldClose) {
          this.ws.close();
          this.shouldClose = false;
        } else {
          this.open = true;
          this.onConnectCallback();
        }
      });

      ws.addEventListener('close', () => {
        this.open = false;
        if (reconnect) {
          this.ws = null;
          setTimeout(() => {
            this.connect();
          }, 1000);
        }
      });

      this.ws = ws;
    };
    this.connect();
  }

  onConnect(cb) {
    this.onConnectCallback = cb;
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
    if (command === 'heartbeat') {
      const justResumed = Date.now() - this.lastWakeTimestamp > HEARTBEAT_PAUSE_TIMEOUT;
      this.lastWakeTimestamp = Date.now();
      // don't send heartbeat if connection not open
      if (!this.open) return;
      // don't send heartbeat if received message recently
      if (Date.now() - this.lastTimestamp < HEARTBEAT_TIMEOUT) return;
      // check if heartbeat is not timed out if not resuming
      // opposite of "if (!this.lastSentTimestamp || justResumed)"
      // same as "if (!(!this.lastSentTimestamp || justResumed))"
      if (this.lastSentTimestamp && !justResumed) {
        // don't send heartbeat if waiting response for heartbeat request
        if (Date.now() - this.lastSentTimestamp < HEARTBEAT_RESPONSE_TIMEOUT) return;
        // close connection when didn't get heartbeat response
        this.close();
        return;
      }
      this.lastSentTimestamp = Date.now();
    }
    const request = { command };
    if (params) request.params = params;
    request.tag = Math.random()
      .toString(36)
      .substring(7);
    this.queue[request.tag] = cb;
    this.send(['request', request]);
  }

  respond(command, tag, message) {
    const respond = { command, tag };
    if (typeof message !== 'undefined') respond.response = message;
    this.send(['response', respond]);
  }

  error(command, tag, message) {
    this.respond(command, tag, { error: message });
  }

  justsaying(subject, body) {
    const justsaying = { subject };
    if (body) justsaying.body = body;
    this.send(['justsaying', justsaying]);
  }
}
