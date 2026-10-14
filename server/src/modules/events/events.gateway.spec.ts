import { EventsGateway, extractSocketToken } from './events.gateway';

const SCHOOL = {
  id: '11111111-1111-4111-8111-111111111111',
  province: 'Kigali',
  district: 'Gasabo',
  sector: 'Remera',
};
const OTHER = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';

function makeGateway(opts: { verify?: jest.Mock; user?: any } = {}) {
  const jwt = { verifyAsync: opts.verify ?? jest.fn() };
  const auth = { validateUser: jest.fn().mockResolvedValue(opts.user) };
  const repo = {
    findOne: jest.fn(({ where }) =>
      Promise.resolve(where.id === SCHOOL.id ? SCHOOL : null),
    ),
  };
  return {
    gw: new EventsGateway(jwt as any, auth as any, repo as any),
    jwt,
    auth,
  };
}

const districtUser = {
  id: USER_ID,
  role: {
    name: 'district_officer',
    accessLevel: { slug: 'district', rank: 30 },
  },
  location: { province: 'Kigali', district: 'Nyarugenge' },
};
const nationalUser = {
  id: USER_ID,
  role: { name: 'admin', accessLevel: null },
};

function fakeSocket(auth: any = {}, headers: any = {}) {
  return {
    id: 's1',
    handshake: { auth, headers },
    data: {} as any,
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };
}

describe('EventsGateway', () => {
  const prev = process.env.SCOPE_ENFORCEMENT;
  beforeAll(() => (process.env.SCOPE_ENFORCEMENT = 'true'));
  afterAll(() => (process.env.SCOPE_ENFORCEMENT = prev));

  it('extracts a token from auth or a Bearer header', () => {
    expect(extractSocketToken(fakeSocket({ token: 't1' }) as any)).toBe('t1');
    expect(
      extractSocketToken(fakeSocket({}, { authorization: 'Bearer t2' }) as any),
    ).toBe('t2');
    expect(extractSocketToken(fakeSocket() as any)).toBeNull();
  });

  it('authenticate() returns null without a token', async () => {
    const { gw } = makeGateway();
    expect(await gw.authenticate(fakeSocket() as any)).toBeNull();
  });

  it('authenticate() returns null for an invalid token', async () => {
    const { gw } = makeGateway({
      verify: jest.fn().mockRejectedValue(new Error('bad')),
    });
    expect(
      await gw.authenticate(fakeSocket({ token: 'bad' }) as any),
    ).toBeNull();
  });

  it('authenticate() loads the user onto client.data', async () => {
    const { gw } = makeGateway({
      verify: jest.fn().mockResolvedValue({ sub: USER_ID }),
      user: nationalUser,
    });
    const s = fakeSocket({ token: 'good' });
    expect(await gw.authenticate(s as any)).toBe(nationalUser);
    expect(s.data.user).toBe(nationalUser);
  });

  it('middleware rejects the handshake before connect when unauthenticated', async () => {
    const { gw } = makeGateway();
    let mw: (c: any, next: (e?: Error) => void) => void = () => {};
    gw.afterInit({ use: (fn: typeof mw) => (mw = fn) } as any);
    const err = await new Promise<Error | undefined>((res) =>
      mw(fakeSocket(), res),
    );
    expect(err?.message).toBe('Unauthorized');
  });

  it('middleware admits an authenticated handshake', async () => {
    const { gw } = makeGateway({
      verify: jest.fn().mockResolvedValue({ sub: USER_ID }),
      user: nationalUser,
    });
    let mw: (c: any, next: (e?: Error) => void) => void = () => {};
    gw.afterInit({ use: (fn: typeof mw) => (mw = fn) } as any);
    const s = fakeSocket({ token: 'good' });
    const err = await new Promise<Error | undefined>((res) => mw(s, res));
    expect(err).toBeUndefined();
    expect(s.data.user).toBe(nationalUser);
  });

  it('handleConnection disconnects a socket with no user', () => {
    const { gw } = makeGateway();
    const s = fakeSocket();
    gw.handleConnection(s as any);
    expect(s.disconnect).toHaveBeenCalledWith(true);
  });

  it('allows only your own user room', async () => {
    const { gw } = makeGateway();
    expect(await gw.canJoin(nationalUser as any, `user:${USER_ID}`)).toBe(true);
    expect(await gw.canJoin(nationalUser as any, `user:${OTHER}`)).toBe(false);
  });

  it('allows a school room only inside the user scope', async () => {
    const { gw } = makeGateway();
    expect(await gw.canJoin(nationalUser as any, `school:${SCHOOL.id}`)).toBe(
      true,
    );
    expect(await gw.canJoin(districtUser as any, `school:${SCHOOL.id}`)).toBe(
      false,
    );
    expect(await gw.canJoin(nationalUser as any, `school:${OTHER}`)).toBe(
      false,
    );
  });

  it('rejects malformed rooms', async () => {
    const { gw } = makeGateway();
    for (const room of ['admin', 'school:*', 'user:', 42, null])
      expect(await gw.canJoin(nationalUser as any, room)).toBe(false);
  });

  it('refuses a join from an unauthenticated socket', async () => {
    const { gw } = makeGateway();
    const s = fakeSocket();
    expect(await gw.handleJoin(`user:${USER_ID}`, s as any)).toEqual({
      ok: false,
    });
    expect(s.join).not.toHaveBeenCalled();
  });
});
