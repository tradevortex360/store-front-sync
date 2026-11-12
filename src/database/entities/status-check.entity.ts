import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ListingStatus } from '../../common/listing.types.js';
import { Listing } from './listing.entity.js';

/**
 * How a single status check ended. Anything other than `ok` means we could not
 * tell the listing's status, which is not the same as the listing being closed.
 */
export const CHECK_OUTCOMES = [
  'ok',
  'timeout',
  'http_error',
  'network_error',
  'invalid_payload',
] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number];

/** One row per status check of one listing. Append-only. */
@Entity({ name: 'status_checks' })
@Index('idx_status_checks_listing_checked_at', ['listingId', 'checkedAt'])
export class StatusCheck {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'listing_id', type: 'text' })
  listingId: string;

  @ManyToOne(() => Listing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing?: Listing;

  @Column({ name: 'checked_at', type: 'timestamptz' })
  checkedAt: Date;

  @Column({ type: 'varchar', length: 32 })
  outcome: CheckOutcome;

  /** Reported status; null when the check did not succeed. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  status: ListingStatus | null;

  @Column({ name: 'http_status', type: 'int', nullable: true })
  httpStatus: number | null;

  @Column({ name: 'latency_ms', type: 'int' })
  latencyMs: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;
}
