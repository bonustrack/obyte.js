# Byteball.js

A simple JavaScript library for Byteball

### Install
```
npm install byteball --save
```

### Usage
```js
const byteball = require('byteball');

// Init WebSocket client
const client = new byteball.Client();

// Get peers
client.api.getPeers(function(err, result) {
  console.log(err, result);
});

// Promises
client.api.getPeers().then(function(result) {
  console.log(result);
});
```

## License

[MIT](LICENSE).
