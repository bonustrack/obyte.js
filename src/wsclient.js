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

const wait = (ws, cb, onClosed) => {
  setTimeout(() => {
    if (ws.readyState === 2 || ws.readyState === 3) {
      // closing or closed: the message can no longer be sent
      if (onClosed) onClosed();
      return;
    }
    if (ws.readyState === 1) {
      if (cb !== null) cb();
    } else {
      wait(ws, cb, onClosed);
    }
  }, 5);
};

export default class WSClient {
  constructor(address, reconnect, closeIfError) {
    this.address = address;
    this.open = false;
    this.shouldClose = false;
    this.reconnect = reconnect || false;
    this.closeIfError = closeIfError || false;
    this.queue = {};
    this.lastTag = 0;
    this.lastTimestamp = Date.now();
    this.lastWakeTimestamp = Date.now();
    this.lastSentTimestamp = null;
    this.notifications = [];
    this.onConnectCallbacks = [];
    this.onErrorCallbacks = [];
    this.connect = () => {
      this.notifications = [];
      const ws = new WebSocket(address);

      ws.addEventListener('message', (payload) => {
        this.lastTimestamp = Date.now();
        let message;
        try {
          message = JSON.parse(payload.data);
        } catch (e) {
          // ignore malformed messages instead of crashing the process
          return;
        }
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
          const { response } = message[1];
          // hub errors always come as {error: ...}; scalar responses (including
          // falsy ones like 0 or '') must be passed through as results
          const error = response && typeof response === 'object' ? response.error || null : null;
          const result = error || response === undefined ? null : response;
          const callback = this.queue[tag];
          delete this.queue[tag]; // cleanup
          callback(error, result);
        } else {
          this.notifications.forEach((n) => n(null, message));
        }
      });

      ws.addEventListener('open', () => {
        this.lastTimestamp = Date.now();
        this.lastWakeTimestamp = Date.now();
        this.lastSentTimestamp = null;
        if (this.shouldClose) {
          this.ws.close();
          this.shouldClose = false;
        } else {
          this.open = true;
          this.onConnectCallbacks.forEach((cb) => cb());
        }
      });

      ws.addEventListener('close', () => {
        this.open = false;
        // reject every request still awaiting a response so its promise doesn't hang
        // forever when the socket drops after the request was sent
        Object.keys(this.queue).forEach((tag) => {
          const cb = this.queue[tag];
          delete this.queue[tag];
          if (cb) cb(new Error('connection closed before response'), null);
        });
        if (this.reconnect) {
          this.ws = null;
          setTimeout(() => {
            this.connect();
          }, 1000);
        }
      });

      ws.addEventListener('error', (err) => {
        // hand the error to subscribers; if nobody subscribed, log it so a failed
        // connection is never swallowed silently (the default when closeIfError is false)
        if (this.onErrorCallbacks.length) {
          this.onErrorCallbacks.forEach((cb) => cb(err));
        } else {
          console.error('WebSocket error', err);
        }
        if (this.closeIfError) {
          // don't reconnect after an error the caller asked us to close on
          this.reconnect = false;
          this.close();
        }
      });

      this.ws = ws;
    };
    this.connect();
  }

  onConnect(cb) {
    this.onConnectCallbacks.push(cb);
  }

  onError(cb) {
    this.onErrorCallbacks.push(cb);
  }

  subscribe(cb) {
    this.notifications.push(cb);
  }

  send(message, onError) {
    if (!this.ws) {
      if (onError) onError();
      return;
    }
    wait(
      this.ws,
      () => {
        this.ws.send(JSON.stringify(message));
      },
      onError,
    );
  }

  close() {
    if (!this.ws) return;
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
    // a monotonic counter guarantees the tag is unique within this connection
    // (the previous Math.random().substring(7) could yield 2-char or colliding tags);
    // the random suffix keeps tags hard to guess
    this.lastTag += 1;
    request.tag = `${this.lastTag}.${Math.random().toString(36).slice(2)}`;
    this.queue[request.tag] = cb;
    this.send(['request', request], () => {
      // socket was closed before we could send: reject instead of leaking the callback forever
      if (this.queue[request.tag]) {
        delete this.queue[request.tag];
        if (cb) cb(new Error(`connection closed before "${command}" request was sent`), null);
      }
    });
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
