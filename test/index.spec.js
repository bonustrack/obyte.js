import { Client } from '../lib/byteball';

describe('Client', () => {
  let client = null;

  beforeAll(() => {
    client = new Client('wss://byteball.fr/bb');
  });

  it('should create client', () => {
    expect(typeof client).toBe('object');
  });

  it('should support callbacks', (done) => {
    client.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=', () => done());
  });

  it('should support promises', (done) => {
    client.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=').then(() => done());
  });
});
