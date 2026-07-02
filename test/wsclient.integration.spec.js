/**
 * Integration test against the real `ws` package (no jest.mock): spins up a local
 * WebSocket server and drives every WSClient method through it. This is what
 * actually verifies the ws 7 -> 8 upgrade, since wsclient.spec.js replaces `ws`
 * with a fake.
 * @jest-environment node
 */

import { WebSocketServer } from 'ws';
import WSClient from '../src/wsclient';
import {
  HEARTBEAT_TIMEOUT,
  HEARTBEAT_RESPONSE_TIMEOUT,
  HEARTBEAT_PAUSE_TIMEOUT,
} from '../src/constants';

describe('WSClient integration (real ws server)', () => {
  let server;
  let client;

  const startServer = () =>
    new Promise((resolve) => {
      server = new WebSocketServer({ port: 0 }, () => {
        resolve(`ws://127.0.0.1:${server.address().port}`);
      });
    });

  const serverConnection = () =>
    new Promise((resolve) => {
      server.once('connection', (socket) => resolve(socket));
    });

  const nextMessage = (socket) =>
    new Promise((resolve) => {
      socket.once('message', (data) => resolve(JSON.parse(data.toString())));
    });

  const connectClient = (address, reconnect = false, closeIfError = false) => {
    client = new WSClient(address, reconnect, closeIfError);
    return new Promise((resolve) => client.onConnect(resolve));
  };

  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  afterEach((done) => {
    // ws 8: server.close() no longer terminates live connections, close them explicitly
    if (client) {
      client.reconnect = false;
      client.close();
      client = null;
    }
    if (server) {
      server.clients.forEach((socket) => socket.terminate());
      server.close(() => done());
      server = null;
    } else {
      done();
    }
  });

  describe('constructor / connect', () => {
    it('starts in CONNECTING state and opens', async () => {
      const address = await startServer();
      client = new WSClient(address, false, false);
      expect(client.ws.readyState).toBe(0); // CONNECTING
      expect(client.open).toBe(false);
      await new Promise((resolve) => client.onConnect(resolve));
      expect(client.ws.readyState).toBe(1); // OPEN
      expect(client.open).toBe(true);
    });

    it('fires every registered onConnect callback', async () => {
      const address = await startServer();
      client = new WSClient(address, false, false);
      const calls = [];
      client.onConnect(() => calls.push('first'));
      client.onConnect(() => calls.push('second'));
      await new Promise((resolve) => client.onConnect(resolve));
      expect(calls).toEqual(['first', 'second']);
    });
  });

  describe('request', () => {
    it('completes a request/response round-trip over a real socket', async () => {
      const address = await startServer();
      server.on('connection', (socket) => {
        socket.on('message', (data) => {
          // ws 8 delivers a Buffer here; WSClient must still get a string via addEventListener
          const [type, request] = JSON.parse(data.toString());
          if (type === 'request' && request.command === 'get_witnesses') {
            socket.send(
              JSON.stringify([
                'response',
                { tag: request.tag, response: ['WITNESS1', 'WITNESS2'] },
              ]),
            );
          }
        });
      });

      await connectClient(address);
      const result = await new Promise((resolve, reject) => {
        client.request('get_witnesses', null, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      expect(result).toEqual(['WITNESS1', 'WITNESS2']);
      expect(Object.keys(client.queue).length).toBe(0);
    });

    it('passes params and delivers a response error to the callback', async () => {
      const address = await startServer();
      server.on('connection', (socket) => {
        socket.on('message', (data) => {
          const [, request] = JSON.parse(data.toString());
          expect(request.params).toEqual({ witnesses: ['W'] });
          socket.send(
            JSON.stringify(['response', { tag: request.tag, response: { error: 'bad params' } }]),
          );
        });
      });

      await connectClient(address);
      const [err, res] = await new Promise((resolve) => {
        client.request('light/get_history', { witnesses: ['W'] }, (e, r) => resolve([e, r]));
      });
      expect(err).toBe('bad params');
      expect(res).toBeNull();
      expect(Object.keys(client.queue).length).toBe(0);
    });

    it('delivers a request queued while the socket is still CONNECTING', async () => {
      const address = await startServer();
      server.on('connection', (socket) => {
        socket.on('message', (data) => {
          const [type, request] = JSON.parse(data.toString());
          if (type === 'request') {
            socket.send(JSON.stringify(['response', { tag: request.tag, response: 'early bird' }]));
          }
        });
      });

      client = new WSClient(address, false, false);
      expect(client.ws.readyState).toBe(0); // CONNECTING: wait() must hold the send until open
      const result = await new Promise((resolve, reject) => {
        client.request('echo', null, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        });
      });
      expect(result).toBe('early bird');
    });

    it('rejects pending requests when the server drops the connection', async () => {
      const address = await startServer();
      server.on('connection', (socket) => {
        socket.on('message', () => socket.terminate()); // never answer, just drop
      });

      await connectClient(address);
      const err = await new Promise((resolve) => {
        client.request('get_witnesses', null, (e) => resolve(e));
      });
      expect(err).toBeInstanceOf(Error);
      expect(Object.keys(client.queue).length).toBe(0);
    });

    it('rejects a request made after the connection already closed', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const closed = new Promise((resolve) => {
        client.ws.addEventListener('close', resolve);
      });
      socket.terminate();
      await closed;

      const err = await new Promise((resolve) => {
        client.request('get_witnesses', null, (e) => resolve(e));
      });
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe('connection closed before "get_witnesses" request was sent');
      expect(Object.keys(client.queue).length).toBe(0);
    });
  });

  describe('request("heartbeat") client-side logic', () => {
    it('does not send a heartbeat when the connection is not open', async () => {
      const address = await startServer();
      client = new WSClient(address, false, false);
      // the test ends while still CONNECTING; teardown may refuse the socket
      client.onError(() => {});
      expect(client.open).toBe(false);
      client.request('heartbeat', null, null);
      expect(Object.keys(client.queue).length).toBe(0);
    });

    it('does not send a heartbeat when a message arrived recently', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const received = [];
      socket.on('message', (data) => received.push(data.toString()));

      client.lastTimestamp = Date.now(); // fresh traffic
      client.request('heartbeat', null, null);
      await sleep(100);
      expect(received).toEqual([]);
      expect(Object.keys(client.queue).length).toBe(0);
    });

    it('sends a heartbeat when idle and clears lastSentTimestamp on response', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      socket.on('message', (data) => {
        const [type, request] = JSON.parse(data.toString());
        if (type === 'request' && request.command === 'heartbeat') {
          socket.send(JSON.stringify(['response', { tag: request.tag, command: 'heartbeat' }]));
        }
      });

      client.lastTimestamp = Date.now() - HEARTBEAT_TIMEOUT - 1; // idle connection
      const responded = new Promise((resolve) => {
        client.request('heartbeat', null, (err, res) => resolve([err, res]));
      });
      expect(client.lastSentTimestamp).not.toBeNull(); // heartbeat is in flight
      const [err, res] = await responded;
      expect(err).toBeNull();
      expect(res).toBeNull();
      expect(client.lastSentTimestamp).toBeNull();
    });

    it('does not send another heartbeat while one is awaiting a response', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const received = [];
      socket.on('message', (data) => received.push(data.toString()));

      client.lastTimestamp = Date.now() - HEARTBEAT_TIMEOUT - 1;
      client.lastSentTimestamp = Date.now() - 1000; // recent unanswered heartbeat
      client.request('heartbeat', null, null);
      await sleep(100);
      expect(received).toEqual([]);
      expect(client.open).toBe(true); // and the connection was not closed
    });

    it('closes the connection when a heartbeat went unanswered for too long', async () => {
      const address = await startServer();
      await connectClient(address);
      // WSClient's own close listener runs first (registration order), so `open`
      // is already false when this later-registered listener fires
      const closed = new Promise((resolve) => {
        client.ws.addEventListener('close', resolve);
      });

      client.lastTimestamp = Date.now() - HEARTBEAT_TIMEOUT - 1;
      client.lastSentTimestamp = Date.now() - HEARTBEAT_RESPONSE_TIMEOUT - 1;
      client.request('heartbeat', null, null);
      await closed;
      expect(client.open).toBe(false);
    });
  });

  describe('incoming server requests (message handler)', () => {
    const serverRequest = async (command, tag) => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const reply = nextMessage(socket);
      socket.send(JSON.stringify(['request', { command, tag }]));
      return reply;
    };

    it('acknowledges a heartbeat request', async () => {
      const [type, response] = await serverRequest('heartbeat', 'hb-tag');
      expect(type).toBe('response');
      expect(response).toEqual({ command: 'heartbeat', tag: 'hb-tag' }); // ack has no response field
    });

    it('responds "sleep" to a heartbeat when timers were suspended', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      client.lastWakeTimestamp = Date.now() - HEARTBEAT_PAUSE_TIMEOUT - 1; // simulate android pause
      const reply = nextMessage(socket);
      socket.send(JSON.stringify(['request', { command: 'heartbeat', tag: 'hb-tag' }]));
      const [type, response] = await reply;
      expect(type).toBe('response');
      expect(response).toEqual({ command: 'heartbeat', tag: 'hb-tag', response: 'sleep' });
    });

    it('refuses a subscribe request', async () => {
      const [type, response] = await serverRequest('subscribe', 'sub-tag');
      expect(type).toBe('response');
      expect(response.tag).toBe('sub-tag');
      expect(response.response).toEqual({ error: "I'm light, cannot subscribe you to updates" });
    });

    it('refuses light/* requests', async () => {
      const [, response] = await serverRequest('light/get_history', 'light-tag');
      expect(response.response).toEqual({ error: "I'm light myself, can't serve you" });
    });

    it('refuses hub/* requests', async () => {
      const [, response] = await serverRequest('hub/deliver', 'hub-tag');
      expect(response.response).toEqual({ error: "I'm not a hub" });
    });
  });

  describe('subscribe (notifications)', () => {
    it('delivers server notifications to subscribers', async () => {
      const address = await startServer();
      server.on('connection', (socket) => {
        socket.send(
          JSON.stringify(['justsaying', { subject: 'version', body: { program: 'test' } }]),
        );
      });

      // subscribe before the connection opens: the server pushes the notification
      // immediately and it must not race with the subscription
      client = new WSClient(address, false, false);
      const message = await new Promise((resolve) => {
        client.subscribe((err, msg) => resolve(msg));
      });
      expect(message).toEqual(['justsaying', { subject: 'version', body: { program: 'test' } }]);
    });

    it('ignores malformed and binary frames and keeps the connection usable', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const message = new Promise((resolve) => {
        client.subscribe((err, msg) => resolve(msg));
      });

      socket.send('<<not json>>'); // malformed text frame
      socket.send(Buffer.from([0xff, 0x00, 0x13, 0x37])); // binary garbage (ws 8: Buffer, isBinary=true)
      socket.send(JSON.stringify(['justsaying'])); // wrong arity, must be skipped
      socket.send(JSON.stringify(['justsaying', { subject: 'still alive' }]));

      expect(await message).toEqual(['justsaying', { subject: 'still alive' }]);
      expect(client.open).toBe(true);
    });
  });

  describe('send / respond / error / justsaying', () => {
    it('sends respond, error and justsaying frames the server can read', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const received = [];
      const gotAll = new Promise((resolve) => {
        socket.on('message', (data) => {
          received.push(JSON.parse(data.toString()));
          if (received.length === 4) {
            resolve();
          }
        });
      });

      client.respond('custom', 'tag-1', 'ok');
      client.error('custom', 'tag-2', 'nope');
      client.justsaying('upgrade', { version: '1.0' });
      client.justsaying('bye');
      await gotAll;

      expect(received).toEqual([
        ['response', { command: 'custom', tag: 'tag-1', response: 'ok' }],
        ['response', { command: 'custom', tag: 'tag-2', response: { error: 'nope' } }],
        ['justsaying', { subject: 'upgrade', body: { version: '1.0' } }],
        ['justsaying', { subject: 'bye' }],
      ]);
    });

    it('calls onError when sending without a socket', async () => {
      const address = await startServer();
      await connectClient(address);
      const socket = client.ws;
      client.ws = null;
      let failed = false;
      client.send({ any: 'thing' }, () => {
        failed = true;
      });
      expect(failed).toBe(true);
      client.ws = socket; // restore so afterEach can close it
    });

    it('calls onError when sending over a closed socket', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      await connectClient(address);
      const socket = await socketPromise;
      const closed = new Promise((resolve) => {
        client.ws.addEventListener('close', resolve);
      });
      socket.terminate();
      await closed;

      const failed = await new Promise((resolve) => {
        client.send(['justsaying', { subject: 'too late' }], () => resolve(true));
      });
      expect(failed).toBe(true);
    });
  });

  describe('close', () => {
    it('defers close requested while still CONNECTING', async () => {
      const address = await startServer();
      const socketPromise = serverConnection();
      client = new WSClient(address, false, false);
      client.close(); // readyState is CONNECTING here
      expect(client.shouldClose).toBe(true);

      const socket = await socketPromise;
      await new Promise((resolve) => {
        socket.on('close', resolve);
      });
      expect(client.shouldClose).toBe(false);
      expect(client.open).toBe(false); // onConnect path was skipped
    });

    it('closes an open connection', async () => {
      const address = await startServer();
      await connectClient(address);
      const closed = new Promise((resolve) => {
        client.ws.addEventListener('close', resolve);
      });
      client.close();
      await closed;
      expect(client.open).toBe(false);
    });
  });

  describe('reconnect', () => {
    it('reconnects after the server drops the connection', async () => {
      const address = await startServer();
      let connections = 0;
      server.on('connection', () => {
        connections += 1;
      });
      const firstSocket = serverConnection();

      await connectClient(address, true);
      const socket = await firstSocket;
      const reconnected = new Promise((resolve) => client.onConnect(resolve));
      socket.terminate(); // drop the live connection; a new one must appear after ~1s
      await reconnected;
      expect(connections).toBe(2);
      expect(client.open).toBe(true);
    }, 10000);
  });

  describe('closeIfError', () => {
    it('fires onError and does not reconnect on connection failure', async () => {
      // grab a port that is guaranteed closed by binding and releasing it
      const address = await startServer();
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
      server = null;

      client = new WSClient(address, false, true);
      const err = await new Promise((resolve) => {
        client.onError((e) => resolve(e));
      });
      expect(err).toBeTruthy();
      expect(err.message).toBeDefined(); // ws 8 ErrorEvent still exposes .message
      expect(client.reconnect).toBe(false);
    });
  });
});
