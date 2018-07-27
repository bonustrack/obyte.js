import { Client } from '..';

describe('Client', () => {
  let client = null;

  beforeAll(() => {
    client = new Client('wss://byteball.org/bb');
  });

  it('should create client', () => {
    expect(typeof client).toBe('object');
  });

  it('should support callbacks', done => {
    client.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=', () => done());
  });

  it('should support promises', done => {
    client.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=').then(() => done());
  });

  it('should support callbacks with empty params', done => {
    client.getBots(() => done());
  });

  it('should support promises with empty params', done => {
    client.getBots().then(() => done());
  });

  it('should catch error with promises', done => {
    client.getParentsAndLastBallAndWitnessListUnit().catch(() => done());
  });

  it('should cache witnesses', async () => {
    const witnesses = [
      'BVVJ2K7ENPZZ3VYZFWQWK7ISPCATFIW3',
      'DJMMI5JYA5BWQYSXDPRZJVLW3UGL3GJS',
      'FOPUBEUPBC6YLIQDLKL6EW775BMV7YOH',
      'GFK3RDAPQLLNCMQEVGGD2KCPZTLSG3HN',
      'H5EZTQE7ABFH27AUDTQFMZIALANK6RBG',
      'I2ADHGP4HL6J37NQAD73J7E5SKFIXJOT',
      'JEDZYC2HMGDBIDQKG3XSTXUSHMCBK725',
      'JPQKPRI5FMTQRJF4ZZMYZYDQVRD55OTC',
      'OYW2XTDKSNKGSEZ27LMGNOPJSYIXHBHC',
      'S7N5FE42F6ONPNDQLCF64E2MGFYKQR2I',
      'TKT4UESIKTTRALRRLWS4SENSTJX6ODCW',
      'UENJPVZ7HVHM6QGVGT6MWOJGGRTUTJXQ',
    ];

    client.getWitnesses = jest.fn().mockReturnValue(witnesses);

    let receivedWitnesses = await client.getCachedWitnesses();
    expect(receivedWitnesses).toEqual(witnesses);
    expect(client.getWitnesses).toHaveBeenCalled();

    client.getWitnesses.mockClear();

    receivedWitnesses = await client.getCachedWitnesses();
    expect(receivedWitnesses).toEqual(witnesses);
    expect(client.getWitnesses).not.toHaveBeenCalled();
  });
});
