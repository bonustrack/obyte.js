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

  describe('composition helpers', () => {
    const auth = {
      address: 'hello',
      privKeyBuf: Buffer.from('test', 'utf-8'),
    };

    it('should compose compose.text', () => {
      const spy = jest.spyOn(client.compose, 'message').mockImplementationOnce(() => {});

      client.compose.text('hey', auth);

      expect(spy).toHaveBeenCalledWith('text', 'hey', auth);
    });

    it('should compose compose.data', () => {
      const spy = jest.spyOn(client.compose, 'message').mockImplementationOnce(() => {});

      client.compose.data({ hello: 'World' }, auth);

      expect(spy).toHaveBeenCalledWith('data', { hello: 'World' }, auth);
    });

    it('should compose post.text', () => {
      const spy = jest.spyOn(client.post, 'message').mockImplementationOnce(() => {});

      client.post.text('hey', auth);

      expect(spy).toHaveBeenCalledWith('text', 'hey', auth);
    });

    it('should compose post.data', () => {
      const spy = jest.spyOn(client.post, 'message').mockImplementationOnce(() => {});

      client.post.data({ hello: 'World' }, auth);

      expect(spy).toHaveBeenCalledWith('data', { hello: 'World' }, auth);
    });
  });
});
