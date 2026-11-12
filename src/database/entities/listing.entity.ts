import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { OpeningHours } from '../../common/listing.types.js';

/** A listing as last seen on the delivery platform. Kept in sync by the worker. */
@Entity({ name: 'listings' })
export class Listing {
  /** The platform's own listing id. */
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  timezone: string;

  @Column({ name: 'listing_url', type: 'text' })
  listingUrl: string;

  @Column({ name: 'opening_hours', type: 'jsonb' })
  openingHours: OpeningHours;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
