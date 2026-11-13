import type { DataSource } from 'typeorm';
import type {
  OpeningHours,
  PlatformListing,
} from '../../common/listing.types.js';
import { AvailabilityCheck } from '../../database/entities/availability-check.entity.js';
import {
  PlatformRequestError,
  type PlatformClient,
  type StatusResult,
} from '../platform/platform.client.js';
import { AvailabilityChecker } from './availability-checker.service.js';

// 11:00–22:00 Berlin time, every day.
const hours: OpeningHours = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [
    d,
    [{ open: '11:00', close: '22:00' }],
  ]),
) as OpeningHours;

const listing = (id: string): PlatformListing => ({
  id,
  name: id,
  timezone: 'Europe/Berlin',
  listingUrl: `http://platform.test/store/${id}`,
  openingHours: hours,
});

const ok = (status: 'OPEN' | 'CLOSED' | 'PAUSED'): StatusResult => ({
  outcome: 'ok',
  status,
  httpStatus: 200,
  latencyMs: 5,
});

/** Records every insert, per entity, instead of talking to Postgres. */
function fakeDataSource() {
  const inserts: { entity: unknown; row: Record<string, unknown> }[] = [];
  const dataSource = {
    getRepository: (entity: unknown) => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push({ entity, row });
      },
      update: () => {
        throw new Error('the worker must never update rows');
      },
    }),
  } as unknown as DataSource;
  return { dataSource, inserts };
}

function fakePlatform(
  listings: PlatformListing[] | Error,
  statuses: Record<string, StatusResult>,
) {
  return {
    fetchListings: async () => {
      if (listings instanceof Error) throw listings;
      return { listings, rejected: [] };
    },
    fetchStatus: async (id: string) => statuses[id],
  } as unknown as PlatformClient;
}

// Friday 2026-11-13 12:00 in Berlin (UTC+1): inside opening hours.
const duringHours = () => new Date('2026-11-13T11:00:00Z');
// Friday 2026-11-13 23:00 in Berlin: outside opening hours.
const afterHours = () => new Date('2026-11-13T22:00:00Z');

const rows = (db: ReturnType<typeof fakeDataSource>) =>
  db.inserts.map((i) => i.row);

describe('AvailabilityChecker.runRound', () => {
  it('inserts one row per comparison during hours, matches included', async () => {
    const db = fakeDataSource();
    const checker = new AvailabilityChecker(
      fakePlatform([listing('a'), listing('b'), listing('c')], {
        a: ok('OPEN'),
        b: ok('PAUSED'),
        c: ok('CLOSED'),
      }),
      db.dataSource,
      duringHours,
    );

    await checker.runRound();

    expect(db.inserts.every((i) => i.entity === AvailabilityCheck)).toBe(true);
    expect(rows(db)).toEqual([
      {
        listingId: 'a',
        checkedAt: duringHours(),
        comparedAt: duringHours(),
        expectedOpen: true,
        actualStatus: 'OPEN',
        result: 'match',
      },
      expect.objectContaining({
        listingId: 'b',
        result: 'paused_during_hours',
      }),
      expect.objectContaining({
        listingId: 'c',
        result: 'closed_during_hours',
      }),
    ]);
  });

  it('flags OPEN outside opening hours, and records CLOSED/PAUSED then as matches', async () => {
    const db = fakeDataSource();
    const checker = new AvailabilityChecker(
      fakePlatform([listing('a'), listing('b'), listing('c')], {
        a: ok('OPEN'),
        b: ok('PAUSED'),
        c: ok('CLOSED'),
      }),
      db.dataSource,
      afterHours,
    );
    await checker.runRound();
    expect(rows(db)).toEqual([
      expect.objectContaining({
        listingId: 'a',
        expectedOpen: false,
        result: 'open_outside_hours',
      }),
      expect.objectContaining({ listingId: 'b', result: 'match' }),
      expect.objectContaining({ listingId: 'c', result: 'match' }),
    ]);
  });

  it('compares at the time the answer arrived, not when it was asked for', async () => {
    const db = fakeDataSource();
    // Asked at 21:59:58 Berlin (open), answered at 22:00:01 (closed).
    const times = [
      new Date('2026-11-13T20:59:58Z'),
      new Date('2026-11-13T21:00:01Z'),
    ];
    const clock = () => times.shift()!;
    const checker = new AvailabilityChecker(
      fakePlatform([listing('a')], { a: ok('CLOSED') }),
      db.dataSource,
      clock,
    );
    await checker.runRound();
    expect(rows(db)).toEqual([
      {
        listingId: 'a',
        checkedAt: new Date('2026-11-13T20:59:58Z'),
        comparedAt: new Date('2026-11-13T21:00:01Z'),
        expectedOpen: false,
        actualStatus: 'CLOSED',
        result: 'match',
      },
    ]);
  });

  it('writes nothing for a failed status check', async () => {
    const db = fakeDataSource();
    const checker = new AvailabilityChecker(
      fakePlatform([listing('a')], {
        a: {
          outcome: 'timeout',
          status: null,
          httpStatus: null,
          latencyMs: 5000,
          error: 'no complete response within 5000 ms',
        },
      }),
      db.dataSource,
      duringHours,
    );
    const summary = await checker.runRound();
    expect(summary.results).toEqual([
      { listingId: 'a', outcome: 'timeout', result: null },
    ]);
    expect(db.inserts).toHaveLength(0);
  });

  it('skips the round when GET /listings fails', async () => {
    const db = fakeDataSource();
    const checker = new AvailabilityChecker(
      fakePlatform(new PlatformRequestError('http_error', 'HTTP 502', 502, 3), {
        a: ok('CLOSED'),
      }),
      db.dataSource,
      duringHours,
    );
    const summary = await checker.runRound();
    expect(summary).toEqual({
      skipped: 'GET /listings failed: HTTP 502',
      results: [],
    });
    expect(db.inserts).toHaveLength(0);
  });
});
