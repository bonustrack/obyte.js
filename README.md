[![npm](https://img.shields.io/npm/v/obyte.svg)](https://www.npmjs.com/package/obyte)
![npm](https://img.shields.io/npm/dm/obyte.svg)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/bonustrack/obyte.js/master/LICENSE)

# Obyte.js

A pure and powerful JavaScript Obyte library.

**[Documentation](https://obytejs.com)**

## Getting started

To install and run Obyte.js, follow this quick start guide

### Install

Obyte.js was designed to work both in the browser and in Node.js.

#### Node.js
To install Obyte.js on Node.js, open your terminal and run:
```
npm i obyte --save
```

#### Browser

You can create an index.html file and include Obyte.js with:

```html
<script src="https://cdn.jsdelivr.net/npm/obyte"></script>
```

### Usage

Ways to initiate WebSocket client:

```js
const obyte = require('obyte');

// Connect to mainnet official node 'wss://obyte.org/bb'
const client = new obyte.Client();

// Connect to a custom node
const client = new obyte.Client('wss://obyte.org/bb');

// Connect to testnet
const options = { testnet: true };
const client = new obyte.Client('wss://obyte.org/bb-test', options);
```

Available client options:

| Option | Default | Description |
| --- | --- | --- |
| `testnet` | `false` | connect to testnet |
| `reconnect` | `false` | automatically reconnect (one attempt per second) after the connection drops |
| `closeIfError` | `false` | close on the first connection error instead of reconnecting |

### Connection lifecycle

`onConnect` fires on every successful connection — including every reconnection when
`reconnect: true` is set. Notification subscriptions live for a single connection *by
design*, so register them inside `onConnect` to have them set up again after every
reconnect:

```js
const client = new obyte.Client('wss://obyte.org/bb', { reconnect: true });

client.onConnect(function() {
  // per-connection setup goes here: it runs again after every reconnect

  // hub-side subscriptions are per-connection too: the hub forgets which AAs
  // this connection watched when it drops, so re-register the watches here
  client.justsaying('light/new_aa_to_watch', {
    aa: 'AA_ADDRESS_TO_WATCH',
  });

  client.subscribe(function(err, result) {
    console.log('notification:', result);
  });
});

// error subscribers persist across reconnections, register them once
client.onError(function(err) {
  console.error('connection error:', err);
});

// the hub drops idle connections, send a heartbeat to keep it alive
setInterval(function() {
  client.api.heartbeat();
}, 10 * 1000);
```

Unlike `subscribe`, the heartbeat timer belongs *outside* `onConnect`: one timer per
client, not per connection. Heartbeats are skipped automatically while the connection
is down (and while there is recent traffic), whereas a timer registered on every
reconnection would pile up duplicates. Call `clearInterval` once you are done with
the client.

Close the client:
```js
client.close();
```

With `reconnect: true` the client treats a closed socket as a dropped connection and
reconnects even after an intentional `close()`. To close such a client permanently,
disable reconnection first:

```js
client.client.reconnect = false;
client.close();
```

All API methods follow this pattern:
```js
// If the last argument is a function it is treated as a callback
client.api.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=', function(err, result) {
  console.log(err, result);
});

// If a callback is not provided, a Promise is returned
client.api.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=').then(function(result) {
  console.log(result);
});
```

### Transaction

To compose and post unit you need first to create a Obyte wallet and fund it with the native currency ‘bytes’. The generated WIF will be used on Obyte.js. Click on the link below to learn more:

[Generate a random address](https://obytejs.com/utils/generate-wallet)

Sending a payment:
```js
const wif = '5JBFvTeSY5...'; // WIF string generated (private key)

const params = {
  outputs: [
    {
      address: 'NX2BTV43XN6BOTCYZUUFU6TK7DVOC4LU', // The Obyte address of the recipient 
      amount: 1000 // The amount he receives
    }
  ]
};

client.post.payment(params, wif, function(err, result) {
  console.log(result); // The unit hash is returned
});
```

## Migration to 0.2.0

`0.2.0` modernizes the internals (updated dependencies, pure-JS crypto, a much smaller
browser bundle) and is **backward compatible for normal use** — addresses, signatures and
WIF keys are byte-for-byte identical, and messages signed by older versions still validate
(and vice-versa). There is **one** breaking change to watch for.

### `utils.fromWif().privateKey` is now a `Uint8Array` (was a `Buffer`)

The bytes are exactly the same — only the type changed, so `Buffer`-specific methods behave
differently:

```js
const { privateKey } = obyte.utils.fromWif(wif, false);

privateKey.toString('hex'); // ❌ 0.1.x: "42...42"  |  0.2.0: "66,66,...,66"
privateKey.equals(other);   // ❌ Uint8Array has no .equals()
```

If your code consumed the private key as a `Buffer`, wrap it once:

```js
const privateKey = Buffer.from(obyte.utils.fromWif(wif, false).privateKey);
// now .toString('hex'), .equals(), etc. work as before
```

Everything else is unchanged. `utils.toWif()` and `utils.signMessage({ privateKey })` still
accept **both** `Buffer` and `Uint8Array`, so passing a `Buffer` keeps working.

## License

[MIT](LICENSE).
