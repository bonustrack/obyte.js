
![CircleCI](https://img.shields.io/circleci/project/github/bonuschain/byteball.js.svg)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/bonuschain/byteball.js/master/LICENSE)

# Byteball.js

A pure and powerful JavaScript Byteball library.

## Getting started

To install and run Byteball.js, follow this quick start guide

### Install

Byteball.js was designed to work both in the browser and in Node.js.

#### Node.js
To install Byteball.js on Node.js, open your terminal and run:
```
npm i byteball --save
```

#### Browser

You can create an index.html file and include Byteball.js with:

```html
<script src="https://cdn.jsdelivr.net/npm/byteball"></script>
```

### Usage

Ways to initiate WebSocket client:

```js
const byteball = require('byteball');

// Connect to mainnet official node 'wss://byteball.org/ws'
const client = new byteball.Client();

// Connect to a custom node
const client = new byteball.Client('wss://byteball.fr/bb');

// Connect to testnet
const client = new byteball.Client('wss://byteball.org/bb-test', true);
```

Close the client:
```js
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

To compose and post unit you need first to create a Byteball wallet and fund it with the native currency ‘bytes’. The generated WIF will be used on Byteball.js. Click on the link below to learn more:

[Generate a random address](https://bonustrack.gitbook.io/byteball/utils/generate-wallet)

Post a payment unit:
```js
const wif = '5JBFvTeSY5...'; // WIF string generated (private key)

const params = {
  outputs: [
    {
      address: 'NX2BTV43XN6BOTCYZUUFU6TK7DVOC4LU', // The Byteball address of the recipient 
      amount: 1000 // The amount he receives
    }
  ]
};

client.post.payment(params, wif, function(err, result) {
  console.log(result); // The unit hash is returned
});
```

## License

[MIT](LICENSE).
