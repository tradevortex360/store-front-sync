import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ListingStatus } from '../../common/listing.types.js';

/**
 * Ways the platform status can disagree with the opening hours.
 * - `open_outside_hours`: customers can order although the restaurant is closed.
 * - `closed_during_hours` / `paused_during_hours`: lost orders, because the
 *   restaurant should be open but customers can't order.
 */
export const MISMATCH_KINDS = [
  'open_outside_hours',
  'closed_during_hours',
  'paused_during_hours',
] as const;
export type MismatchKind = (typeof MISMATCH_KINDS)[number];

/** Outcome of one comparison: `match`, or the kind of mismatch. */
export const CHECK_RESULTS = ['match', ...MISMATCH_KINDS] as const;
export type CheckResult = (typeof CHECK_RESULTS)[number];

/**
 * One row per comparison of a listing's platform status with its opening hours,
 * matches included. Append-only: the worker only inserts, never updates.
 * `listing_id` is the platform's id; there is no foreign key, because the worker
 * reads listings from the platform, not from the `listings` table.
 */
@Entity({ name: 'availability_checks' })
@Index('idx_availability_checks_listing_compared_at', [
  'listingId',
  'comparedAt',
])
export class AvailabilityCheck {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'listing_id', type: 'text' })
  listingId: string;

  /** When the worker asked the platform for the status. */
  @Column({ name: 'checked_at', type: 'timestamptz' })
  checkedAt: Date;

  /** When the worker compared the status with the opening hours, right after the answer. */
  @Column({ name: 'compared_at', type: 'timestamptz' })
  comparedAt: Date;

  /** What the opening hours say: should the listing be open at `compared_at`? */
  @Column({ name: 'expected_open', type: 'boolean' })
  expectedOpen: boolean;

  @Column({ name: 'actual_status', type: 'varchar', length: 16 })
  actualStatus: ListingStatus;

  @Column({ type: 'varchar', length: 32 })
  result: CheckResult;
}
