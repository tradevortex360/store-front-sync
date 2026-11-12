import type { DataSource } from 'typeorm';
import type {
  OpeningHours,
  PlatformListing,
} from '../../common/listing.types.js';
import { Listing } from '../../database/entities/listing.entity.js';
import { Mismatch } from '../../database/entities/mismatch.entity.js';
import { StatusCheck } from '../../database/entities/status-check.entity.js';
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

/** Records what the checker writes instead of talking to Postgres. */
function fakeDataSource(storedListings: Listing[] = []) {
  const inserts: { entity: unknown; row: Record<string, unknown> }[] = [];
  const upserts: unknown[] = [];
  let nextId = 1;
  const em = {
    insert: async (entity: unknown, row: Record<string, unknown>) => {
      inserts.push({ entity, row });
      return { identifiers: [{ id: String(nextId++) }] };
    },
  };
  const dataSource = {
    getRepository: () => ({
      upsert: async (rows: unknown) => upserts.push(rows),
      find: async () => storedListings,
    }),
    transaction: async (fn: (e: typeof em) => Promise<unknown>) => fn(em),
  } as unknown as DataSource;
  const rows = (entity: unknown) =>
    inserts.filter((i) => i.entity === entity).map((i) => i.row);
  return { dataSource, upserts, rows };
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

describe('AvailabilityChecker.runRound', () => {
  it('stores a status check per listing and a mismatch only for contradictions', async () => {
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

    const summary = await checker.runRound();

    expect(summary.listingsSource).toBe('platform');
    expect(db.upserts).toHaveLength(1);
    expect(db.rows(StatusCheck)).toHaveLength(3);
    expect(db.rows(Mismatch)).toEqual([
      expect.objectContaining({
        listingId: 'b',
        statusCheckId: '2',
        expectedOpen: true,
        actualStatus: 'PAUSED',
        kind: 'paused_during_hours',
        detectedAt: duringHours(),
      }),
      expect.objectContaining({
        listingId: 'c',
        statusCheckId: '3',
        kind: 'closed_during_hours',
      }),
    ]);
  });

  it('flags OPEN outside opening hours, and accepts CLOSED/PAUSED then', async () => {
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
    expect(db.rows(Mismatch)).toEqual([
      expect.objectContaining({
        listingId: 'a',
        expectedOpen: false,
        kind: 'open_outside_hours',
      }),
    ]);
  });

  it('stores failed checks with their outcome but never as a mismatch', async () => {
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
      { listingId: 'a', outcome: 'timeout', mismatch: null },
    ]);
    expect(db.rows(StatusCheck)).toEqual([
      expect.objectContaining({
        outcome: 'timeout',
        status: null,
        error: 'no complete response within 5000 ms',
      }),
    ]);
    expect(db.rows(Mismatch)).toHaveLength(0);
  });

  it('falls back to the stored listings when GET /listings fails', async () => {
    const stored = Object.assign(new Listing(), listing('a'));
    const db = fakeDataSource([stored]);
    const checker = new AvailabilityChecker(
      fakePlatform(new PlatformRequestError('http_error', 'HTTP 502', 502, 3), {
        a: ok('CLOSED'),
      }),
      db.dataSource,
      duringHours,
    );
    const summary = await checker.runRound();
    expect(summary.listingsSource).toBe('database');
    expect(db.upserts).toHaveLength(0);
    expect(db.rows(Mismatch)).toEqual([
      expect.objectContaining({ listingId: 'a', kind: 'closed_during_hours' }),
    ]);
  });
});
