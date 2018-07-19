const { Client } = require('..');

const client = new Client('wss://byteball.org/bb');

async function test() {
  const joint = await client.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=');

  console.log(joint);
}

test();
