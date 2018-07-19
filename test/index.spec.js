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
    client.getJoint('12345', () => done());
  });

  it('should support promises', (done) => {
    client.getJoint('12345').then(() => done());
  });
});
