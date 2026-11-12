import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { PlatformListing } from '../../common/listing.types.js';
import {
  Mismatch,
  type MismatchKind,
} from '../../database/entities/mismatch.entity.js';
import type { CheckOutcome } from '../../database/entities/status-check.entity.js';
import type { PlatformClient } from '../platform/platform.client.js';
import { detectMismatch, isWithinOpeningHours } from './opening-hours.js';

export interface ListingCheckResult {
  listingId: string;
  outcome: CheckOutcome;
  mismatch: MismatchKind | null;
}

export interface RoundSummary {
  /** Set when the round could not run because `GET /listings` gave no usable answer. */
  skipped?: string;
  results: ListingCheckResult[];
}

/**
 * One check round: read the listings and their opening hours from the platform, ask for
 * each listing's status, compare the two and store a row in `mismatches` when they
 * disagree. Nothing else is written to the database.
 */
export class AvailabilityChecker {
  private readonly logger = new Logger(AvailabilityChecker.name);

  constructor(
    private readonly platform: PlatformClient,
    private readonly dataSource: DataSource,
    /** Injectable clock, for tests. */
    private readonly now: () => Date = () => new Date(),
  ) {}

  async runRound(): Promise<RoundSummary> {
    let listings: PlatformListing[];
    try {
      const fetched = await this.platform.fetchListings();
      listings = fetched.listings;
      for (const r of fetched.rejected)
        this.logger.warn(
          `skipping listing #${r.index} (id ${JSON.stringify(r.id)}), it breaks the contract: ${r.error}`,
        );
    } catch (err) {
      // Without opening hours there is nothing to compare against.
      const reason = `GET /listings failed: ${(err as Error).message}`;
      this.logger.warn(`round skipped, ${reason}`);
      return { skipped: reason, results: [] };
    }

    // Check listings concurrently so one slow listing doesn't delay the others.
    // Each request has its own timeout in the client.
    const settled = await Promise.allSettled(
      listings.map((listing) => this.checkListing(listing)),
    );
    const results: ListingCheckResult[] = [];
    settled.forEach((s, i) => {
      if (s.status === 'fulfilled') results.push(s.value);
      else
        this.logger.error(
          `could not store the mismatch for ${listings[i].id}: ${String(s.reason)}`,
        );
    });
    this.logSummary(listings.length, results);
    return { results };
  }

  private async checkListing(
    listing: PlatformListing,
  ): Promise<ListingCheckResult> {
    const checkedAt = this.now();
    const result = await this.platform.fetchStatus(listing.id);

    // Only a successful check can be a mismatch. "Couldn't tell" is not "closed".
    if (result.outcome !== 'ok') {
      this.logger.warn(`${listing.id}: ${result.outcome}: ${result.error}`);
      return { listingId: listing.id, outcome: result.outcome, mismatch: null };
    }

    const expectedOpen = isWithinOpeningHours(
      listing.openingHours,
      listing.timezone,
      checkedAt,
    );
    const mismatch = detectMismatch(expectedOpen, result.status);
    if (mismatch) {
      await this.dataSource.getRepository(Mismatch).insert({
        listingId: listing.id,
        detectedAt: checkedAt,
        expectedOpen,
        actualStatus: result.status,
        kind: mismatch,
      });
      this.logger.warn(
        `MISMATCH ${listing.id}: platform says ${result.status}, opening hours say ${expectedOpen ? 'open' : 'closed'} (${mismatch})`,
      );
    }
    return { listingId: listing.id, outcome: 'ok', mismatch };
  }

  private logSummary(total: number, results: ListingCheckResult[]) {
    const outcomes = new Map<string, number>();
    for (const r of results)
      outcomes.set(r.outcome, (outcomes.get(r.outcome) ?? 0) + 1);
    const breakdown = [...outcomes].map(([k, v]) => `${v} ${k}`).join(', ');
    const mismatches = results.filter((r) => r.mismatch).length;
    this.logger.log(
      `round done: ${total} listings, ${breakdown || 'no checks'}, ${mismatches} mismatch(es) stored`,
    );
  }
}
