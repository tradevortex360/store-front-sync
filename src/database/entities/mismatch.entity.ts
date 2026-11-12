import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ListingStatus } from '../../common/listing.types.js';
import { Listing } from './listing.entity.js';
import { StatusCheck } from './status-check.entity.js';

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

/** One row per successful status check whose status contradicts the opening hours. Append-only. */
@Entity({ name: 'mismatches' })
@Index('idx_mismatches_listing_detected_at', ['listingId', 'detectedAt'])
export class Mismatch {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'listing_id', type: 'text' })
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  /** The status check that found the mismatch (at most one mismatch per check). */
  @Column({ name: 'status_check_id', type: 'bigint', unique: true })
  statusCheckId: string;

  @OneToOne(() => StatusCheck, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_check_id' })
  statusCheck?: StatusCheck;

  /** Same instant as the status check's `checked_at`. */
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
