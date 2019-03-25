import { Client } from '..';

describe('Client', () => {
  let client = null;

  beforeAll(() => {
    client = new Client('wss://obyte.org/bb');
  });

  it('should create client', () => {
    expect(typeof client).toBe('object');
  });

  it('should support callbacks', done => {
    client.api.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=', () => done());
  });

  it('should support promises', done => {
    client.api.getJoint('oj8yEksX9Ubq7lLc+p6F2uyHUuynugeVq4+ikT67X6E=').then(() => done());
  });

  it('should support callbacks with empty params', done => {
    client.api.getBots(() => done());
  });

  it('should support promises with empty params', done => {
    client.api.getBots().then(() => done());
  });

  it('should catch error with promises', done => {
    client.api.getParentsAndLastBallAndWitnessListUnit().catch(() => done());
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

    client.api.getWitnesses = jest.fn().mockReturnValue(witnesses);

    let receivedWitnesses = await client.getCachedWitnesses();
    expect(receivedWitnesses).toEqual(witnesses);
    expect(client.api.getWitnesses).toHaveBeenCalled();

    client.api.getWitnesses.mockClear();

    receivedWitnesses = await client.getCachedWitnesses();
    expect(receivedWitnesses).toEqual(witnesses);
    expect(client.api.getWitnesses).not.toHaveBeenCalled();
  });
});
