import { PlatformClient } from './platform.client.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const clientReturning = (respond: () => Response | Promise<Response>) =>
  new PlatformClient('http://platform.test', 50, (async () =>
    respond()) as typeof fetch);

const validListing = {
  id: 'lst_1',
  name: 'Test',
  timezone: 'Europe/Berlin',
  listingUrl: 'http://platform.test/store/test',
  openingHours: {
    mon: [{ open: '11:00', close: '22:00' }],
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat: [],
    sun: [],
  },
};

describe('PlatformClient.fetchStatus', () => {
  it('returns the status of a valid answer', async () => {
    const result = await clientReturning(() =>
      json({ status: 'PAUSED' }),
    ).fetchStatus('lst_1');
    expect(result).toMatchObject({
      outcome: 'ok',
      status: 'PAUSED',
      httpStatus: 200,
    });
  });

  it('calls the status URL of the listing', async () => {
    let url = '';
    const client = new PlatformClient('http://platform.test', 50, (async (
      input: URL,
    ) => {
      url = String(input);
      return json({ status: 'OPEN' });
    }) as typeof fetch);
    await client.fetchStatus('lst_1');
    expect(url).toBe('http://platform.test/listings/lst_1/status');
  });

  it.each([
    ['wrong enum case', { status: 'open' }],
    ['unknown enum value', { status: 'BUSY' }],
    ['renamed field', { state: 'OPEN' }],
    ['null', null],
  ])('marks %s as invalid_payload', async (_, body) => {
    const result = await clientReturning(() => json(body)).fetchStatus('lst_1');
    expect(result).toMatchObject({ outcome: 'invalid_payload', status: null });
  });

  it.each([
    ['truncated JSON', '{"status":"OP'],
    ['HTML error page', '<html><body>Bad gateway</body></html>'],
    ['empty body', ''],
  ])('marks %s as invalid_payload', async (_, text) => {
    const result = await clientReturning(
      () => new Response(text, { status: 200 }),
    ).fetchStatus('lst_1');
    expect(result).toMatchObject({
      outcome: 'invalid_payload',
      httpStatus: 200,
    });
  });

  it('marks a non-2xx answer as http_error with its status code', async () => {
    const result = await clientReturning(() =>
      json({ error: 'boom' }, 503),
    ).fetchStatus('lst_1');
    expect(result).toMatchObject({ outcome: 'http_error', httpStatus: 503 });
    expect(result.outcome !== 'ok' && result.error).toContain('HTTP 503');
  });

  it('marks a slow answer as timeout', async () => {
    const client = new PlatformClient(
      'http://platform.test',
      20,
      ((_: URL, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener('abort', () =>
            reject(init.signal!.reason),
          ),
        )) as typeof fetch,
    );
    const result = await client.fetchStatus('lst_1');
    expect(result).toMatchObject({ outcome: 'timeout', httpStatus: null });
    expect(result.latencyMs).toBeGreaterThanOrEqual(15);
  });

  it('marks a refused connection as network_error', async () => {
    const result = await clientReturning(() => {
      throw new TypeError('fetch failed', {
        cause: new Error('connect ECONNREFUSED'),
      });
    }).fetchStatus('lst_1');
    expect(result).toMatchObject({
      outcome: 'network_error',
      httpStatus: null,
    });
    expect(result.outcome !== 'ok' && result.error).toContain('ECONNREFUSED');
  });
});

describe('PlatformClient.fetchListings', () => {
  it('keeps valid listings and reports the broken ones', async () => {
    const { listings, rejected } = await clientReturning(() =>
      json([
        validListing,
        { ...validListing, id: 'lst_2', timezone: 'Mars/Olympus_Mons' },
        {
          ...validListing,
          id: 'lst_3',
          openingHours: {
            ...validListing.openingHours,
            mon: [{ open: '25:99', close: '22:00' }],
          },
        },
        { ...validListing, id: undefined },
      ]),
    ).fetchListings();
    expect(listings.map((l) => l.id)).toEqual(['lst_1']);
    expect(rejected.map((r) => r.index)).toEqual([1, 2, 3]);
  });

  it.each([
    ['a wrapped array', { data: [validListing] }],
    ['null', null],
  ])('rejects %s as a whole', async (_, body) => {
    await expect(
      clientReturning(() => json(body)).fetchListings(),
    ).rejects.toMatchObject({ outcome: 'invalid_payload' });
  });
});
