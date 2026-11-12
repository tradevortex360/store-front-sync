/**
 * Contract of the delivery platform, shared by the mock (producer) and the
 * worker/api (consumers).
 */
export const WEEKDAYS = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** "HH:mm" in the listing's local time. `close` earlier than `open` means the slot runs past midnight. */
export interface TimeSlot {
  open: string;
  close: string;
}

export type OpeningHours = Record<Weekday, TimeSlot[]>;

export interface PlatformListing {
  id: string;
  name: string;
  /** IANA timezone, e.g. "Europe/Berlin". */
  timezone: string;
  listingUrl: string;
  openingHours: OpeningHours;
}

export const LISTING_STATUSES = ['OPEN', 'CLOSED', 'PAUSED'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];
