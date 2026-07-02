/* Regenerates test/units.fixtures.json — real mainnet joints of every protocol
   version (1.0 genesis, 2.0, 3.0, 4.0) used by unit-hashes.spec.js to pin getUnitHash.
   Usage: npm run build:cjs && node test/regenerate-fixtures.js */
const fs = require('fs');
const path = require('path');
const { Client } = require('../lib/index.js');
const { getUnitHash } = require('../lib/internal.js');

const GENESIS = 'oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=';
const REGISTRY = 'O6H6ZIFI57X3PLTYHOCVYPP5A553CYFQ'; // official token registry AA

async function main() {
  const client = new Client('wss://obyte.org/bb');
  await new Promise((resolve) => client.onConnect(resolve));

  const fixtures = {};
  async function addUnit(label, unitHash) {
    const { joint } = await client.api.getJoint(unitHash);
    if (getUnitHash(joint.unit) !== unitHash) {
      throw new Error(`${label}: computed hash does not match ${unitHash} — refusing to pin`);
    }
    fixtures[label] = { expected_unit: unitHash, unit: joint.unit };
    console.log(`${label}: version ${joint.unit.version}, ${unitHash}`);
  }

  await addUnit('v1', GENESIS);
  // registry triggers pin one unit per protocol era; every query below is
  // anchored to fixed mci bounds, so regeneration is idempotent
  const early = await client.api.getAaResponses({ aa: REGISTRY, order: 'ASC' });
  await addUnit('v2', early[0].trigger_unit);
  const mid = await client.api.getAaResponses({ aa: REGISTRY, max_mci: 9000000, order: 'DESC' });
  await addUnit('v3', mid[0].trigger_unit);
  // first registry trigger at/after the v4 upgrade (mainnet v4UpgradeMci)
  const v4era = await client.api.getAaResponses({ aa: REGISTRY, min_mci: 10968000, order: 'ASC' });
  await addUnit('v4', v4era[0].trigger_unit);

  const file = path.join(__dirname, 'units.fixtures.json');
  fs.writeFileSync(file, `${JSON.stringify(fixtures, null, 2)}\n`);
  console.log(`written ${file}`);
  client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
