import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ListingStatus,
  PlatformListing,
} from '../../common/listing.types.js';
import { buildSeed } from './listings.seed.js';

/**
 * In-memory state of the mock platform. Statuses are static per listing and
 * only change through the admin API, so a mismatch is always something you
 * staged on purpose.
 */
@Injectable()
export class ListingsStore {
  private readonly listings: PlatformListing[];
  private readonly initialStatuses: Map<string, ListingStatus>;
  private readonly statuses = new Map<string, ListingStatus>();

  constructor(config: ConfigService) {
    const seed = buildSeed(config.getOrThrow<string>('PLATFORM_PUBLIC_URL'));
    this.listings = seed.map((s) => s.listing);
    this.initialStatuses = new Map(
      seed.map((s) => [s.listing.id, s.initialStatus]),
    );
    this.resetStatuses();
  }

  all(): PlatformListing[] {
    return this.listings;
  }

  has(id: string): boolean {
    return this.statuses.has(id);
  }

  getStatus(id: string): ListingStatus {
    const status = this.statuses.get(id);
    if (!status) throw new NotFoundException(`Listing ${id} not found`);
    return status;
  }

  setStatus(id: string, status: ListingStatus): void {
    this.getStatus(id);
    this.statuses.set(id, status);
  }

  allStatuses(): Record<string, ListingStatus> {
    return Object.fromEntries(this.statuses);
  }

  resetStatuses(): void {
    this.statuses.clear();
    for (const [id, status] of this.initialStatuses)
      this.statuses.set(id, status);
  }
}
