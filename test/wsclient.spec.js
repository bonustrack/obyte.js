/**
 * Run in the node environment so wsclient.js takes the `require('ws')` branch
 * (in jsdom `window` exists and it would use the browser WebSocket instead).
 * @jest-environment node
 */

// Mock `ws` with a minimal fake socket so we can drive WSClient without a real
// network connection. The factory is hoisted above imports by babel-jest, so the
// fake is defined inline (it cannot reference outer-scope, non-`mock`-prefixed vars).
jest.mock('ws', () =>
  jest.fn().mockImplementation(function FakeSocket(address) {
    this.address = address;
    this.readyState = 1; // OPEN
    this.listeners = {};
    this.sent = [];
    this.addEventListener = (type, cb) => {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(cb);
    };
    this.emit = (type, ev) => {
      (this.listeners[type] || []).forEach((cb) => cb(ev));
    };
    this.send = (data) => {
      this.sent.push(data);
    };
    this.close = () => {
      this.readyState = 3; // CLOSED
    };
  }),
);

// Use require (not `import`) so jest.mock('ws') is registered before wsclient.js
// captures `WebSocket = require('ws')` at module load. add-module-exports makes the
// default export available directly on module.exports.
const WSClient = require('../src/wsclient');

describe('WSClient', () => {
  it('generates unique request tags', () => {
    const client = new WSClient('ws://node', false, false);
    const noop = () => {};
    for (let i = 0; i < 300; i += 1) client.request('get_witnesses', null, noop);

    const tags = Object.keys(client.queue);
    expect(tags.length).toBe(300);
    expect(new Set(tags).size).toBe(300); // no collisions

    client.ws.readyState = 3; // neutralize the pending send() timers
  });

  it('ignores malformed messages instead of throwing', () => {
    const client = new WSClient('ws://node', false, false);
    expect(() => client.ws.emit('message', { data: '<<not json>>' })).not.toThrow();
    expect(() => client.ws.emit('message', { data: '' })).not.toThrow();
  });

  it('rejects a request if the socket is already closed', (done) => {
    const client = new WSClient('ws://node', false, false);
    client.ws.readyState = 3; // CLOSED
    client.request('get_witnesses', null, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(Object.keys(client.queue).length).toBe(0);
      done();
    });
  });

  it('rejects pending requests when the socket drops after sending', (done) => {
    const client = new WSClient('ws://node', false, false);
    client.request('get_witnesses', null, (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(Object.keys(client.queue).length).toBe(0);
      done();
    });
    expect(Object.keys(client.queue).length).toBe(1); // still waiting for a response
    client.ws.readyState = 3; // CLOSED
    client.ws.emit('close'); // connection dropped before the response arrived
  });

  it('passes falsy scalar responses through instead of nulling them', (done) => {
    const client = new WSClient('ws://node', false, false);
    const received = [];
    const respond = (response) => {
      const tag = Object.keys(client.queue)[0];
      client.ws.emit('message', { data: JSON.stringify(['response', { tag, response }]) });
    };

    client.request('light/get_data_feed', { feed_name: 'x' }, (err, result) => {
      received.push([err, result]);
      client.request('light/get_data_feed', { feed_name: 'y' }, (err2, result2) => {
        received.push([err2, result2]);
        client.request('get_witnesses', null, (err3, result3) => {
          received.push([err3, result3]);
          expect(received).toEqual([
            [null, 0], // numeric 0 data feed value must not become null
            [null, ''], // empty string as well
            ['some error', null], // {error} responses still reject
          ]);
          done();
        });
        respond({ error: 'some error' });
      });
      respond('');
    });
    respond(0);
  });

  it('delivers socket errors to onError subscribers instead of logging', () => {
    const client = new WSClient('ws://node', false, false);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const received = [];
    client.onError((err) => received.push(err));

    const boom = new Error('boom');
    client.ws.emit('error', boom);

    expect(received).toEqual([boom]);
    expect(spy).not.toHaveBeenCalled(); // subscriber handles it, no console noise
    spy.mockRestore();
  });

  it('logs socket errors when nobody subscribed (not swallowed silently)', () => {
    const client = new WSClient('ws://node', false, false);
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});

    client.ws.emit('error', new Error('boom'));

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
