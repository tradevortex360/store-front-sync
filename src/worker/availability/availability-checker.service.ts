import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PlatformListing } from '../../common/listing.types.js';
import { Listing } from '../../database/entities/listing.entity.js';
import {
  Mismatch,
  type MismatchKind,
} from '../../database/entities/mismatch.entity.js';
import {
  StatusCheck,
  type CheckOutcome,
} from '../../database/entities/status-check.entity.js';
import { PlatformClient } from '../platform/platform.client.js';
import { detectMismatch, isWithinOpeningHours } from './opening-hours.js';

export interface ListingCheckResult {
  listingId: string;
  outcome: CheckOutcome;
  mismatch: MismatchKind | null;
}

export interface RoundSummary {
  /** Where this round's listings came from. `database` = platform list unavailable, last known list used. */
  listingsSource: 'platform' | 'database';
  results: ListingCheckResult[];
}

/**
 * One check round: refresh the listings, ask the platform for each listing's status,
 * compare it with the opening hours and store the result.
 */
@Injectable()
export class AvailabilityChecker {
  private readonly logger = new Logger(AvailabilityChecker.name);

  constructor(
    private readonly platform: PlatformClient,
    private readonly dataSource: DataSource,
    /** Injectable clock, for tests. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async runRound(): Promise<RoundSummary> {
    const { listings, source } = await this.loadListings();
    // The status endpoint is per listing; check them concurrently so one slow listing
    // doesn't delay the others. Each check has its own timeout in the client.
    const settled = await Promise.allSettled(
      listings.map((listing) => this.checkListing(listing)),
    );
    const results: ListingCheckResult[] = [];
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled') results.push(s.value);
      else
        this.logger.error(
          `could not store the check for ${listings[i].id}: ${String(s.reason)}`,
        );
    });
    this.logSummary(source, listings.length, results);
    return { listingsSource: source, results };
  }

  /**
   * Fetches the platform's listings and saves them, so opening hours are known even when
   * the list endpoint is down later. If it is down now, falls back to the last known list.
   */
  private async loadListings(): Promise<{
    listings: Pick<PlatformListing, 'id' | 'timezone' | 'openingHours'>[];
    source: RoundSummary['listingsSource'];
  }> {
    const repo = this.dataSource.getRepository(Listing);
    try {
      const { listings, rejected } = await this.platform.fetchListings();
      for (const r of rejected)
        this.logger.warn(
          `skipping listing #${r.index} (id ${JSON.stringify(r.id)}), it breaks the contract: ${r.error}`,
        );
      if (listings.length > 0) {
        await repo.upsert(
          listings.map((l) => ({
            id: l.id,
            name: l.name,
            timezone: l.timezone,
            listingUrl: l.listingUrl,
            openingHours: l.openingHours,
          })),
          ['id'],
        );
      }
      return { listings, source: 'platform' };
    } catch (err) {
      const known = await repo.find({ order: { id: 'ASC' } });
      this.logger.warn(
        `GET /listings failed (${(err as Error).message}); using ${known.length} listings from the database`,
      );
      return { listings: known, source: 'database' };
    }
  }

  private async checkListing(
    listing: Pick<PlatformListing, 'id' | 'timezone' | 'openingHours'>,
  ): Promise<ListingCheckResult> {
    const checkedAt = this.now();
    const result = await this.platform.fetchStatus(listing.id);

    let expectedOpen: boolean | null = null;
    let mismatch: MismatchKind | null = null;
    // Only a successful check can be a mismatch. "Couldn't tell" is not "closed".
    if (result.outcome === 'ok') {
      expectedOpen = isWithinOpeningHours(
        listing.openingHours,
        listing.timezone,
        checkedAt,
      );
      mismatch = detectMismatch(expectedOpen, result.status);
    }

    await this.dataSource.transaction(async (em) => {
      const inserted = await em.insert(StatusCheck, {
        listingId: listing.id,
        checkedAt,
        outcome: result.outcome,
        status: result.status,
        httpStatus: result.httpStatus,
        latencyMs: result.latencyMs,
        error: result.outcome === 'ok' ? null : result.error,
      });
      if (mismatch && result.status && expectedOpen !== null) {
        await em.insert(Mismatch, {
          listingId: listing.id,
          statusCheckId: String(inserted.identifiers[0].id),
          detectedAt: checkedAt,
          expectedOpen,
          actualStatus: result.status,
          kind: mismatch,
        });
      }
    });

    if (mismatch)
      this.logger.warn(
        `MISMATCH ${listing.id}: platform says ${result.status}, opening hours say ${expectedOpen ? 'open' : 'closed'} (${mismatch})`,
      );
    else if (result.outcome !== 'ok')
      this.logger.warn(`${listing.id}: ${result.outcome}: ${result.error}`);

    return { listingId: listing.id, outcome: result.outcome, mismatch };
  }

  private logSummary(
    source: RoundSummary['listingsSource'],
    total: number,
    results: ListingCheckResult[],
  ) {
    const outcomes = new Map<string, number>();
    for (const r of results)
      outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1);
    const breakdown = [...outcomes].map(([k, v]) => `${v} ${k}`).join(', ');
    const mismatches = results.filter((r) => r.mismatch).length;
    this.logger.log(
      `round done: ${total} listings (from ${source}), ${breakdown || 'no checks'}, ${mismatches} mismatch(es)`,
    );
  }
}
