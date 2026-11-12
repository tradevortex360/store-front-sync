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

/**
 * One row per status check whose status contradicts the opening hours. Append-only.
 * The only table the worker writes to. `listing_id` is the platform's id; there is no
 * foreign key, because the worker reads listings from the platform, not from `listings`.
 */
@Entity({ name: 'mismatches' })
@Index('idx_mismatches_listing_detected_at', ['listingId', 'detectedAt'])
export class Mismatch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'listing_id', type: 'text' })
  listingId: string;

  /** When the status was requested. */
  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  /** What the opening hours say: should the listing be open at `detected_at`? */
  @Column({ name: 'expected_open', type: 'boolean' })
  expectedOpen: boolean;

  @Column({ name: 'actual_status', type: 'varchar', length: 16 })
  actualStatus: ListingStatus;

  @Column({ type: 'varchar', length: 32 })
  kind: MismatchKind;
}
