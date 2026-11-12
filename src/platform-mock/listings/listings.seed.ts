import type {
  ListingStatus,
  OpeningHours,
  PlatformListing,
  TimeSlot,
} from '../../common/listing.types.js';

const closed: TimeSlot[] = [];
const slot = (open: string, close: string): TimeSlot => ({ open, close });
const everyDay = (...slots: TimeSlot[]): OpeningHours => ({
  mon: slots,
  tue: slots,
  wed: slots,
  thu: slots,
  fri: slots,
  sat: slots,
  sun: slots,
});

interface SeedListing extends Omit<PlatformListing, 'listingUrl'> {
  slug: string;
  initialStatus: ListingStatus;
}

/**
 * Five listings across five timezones, chosen to cover the cases the
 * mismatch logic will have to handle:
 * - split shifts (lunch + dinner)
 * - slots running past midnight (close < open)
 * - a fully closed weekday (empty list)
 */
const SEED: SeedListing[] = [
  {
    id: 'lst_ber_001',
    slug: 'curry-kontor-berlin-mitte',
    name: 'Curry Kontor Berlin-Mitte',
    timezone: 'Europe/Berlin',
    openingHours: {
      mon: [slot('11:00', '15:00'), slot('17:00', '22:00')],
      tue: [slot('11:00', '15:00'), slot('17:00', '22:00')],
      wed: [slot('11:00', '15:00'), slot('17:00', '22:00')],
      thu: [slot('11:00', '15:00'), slot('17:00', '22:00')],
      fri: [slot('11:00', '15:00'), slot('17:00', '23:00')],
      sat: [slot('12:00', '23:00')],
      sun: closed,
    },
    initialStatus: 'OPEN',
  },
  {
    id: 'lst_vie_002',
    slug: 'schnitzelhaus-neubau-wien',
    name: 'Schnitzelhaus Neubau',
    timezone: 'Europe/Vienna',
    openingHours: { ...everyDay(slot('11:30', '22:00')), mon: closed },
    initialStatus: 'OPEN',
  },
  {
    id: 'lst_hel_003',
    slug: 'pho-kallio-helsinki',
    name: 'Pho Kallio',
    timezone: 'Europe/Helsinki',
    openingHours: {
      mon: [slot('10:30', '21:00')],
      tue: [slot('10:30', '21:00')],
      wed: [slot('10:30', '21:00')],
      thu: [slot('10:30', '21:00')],
      fri: [slot('10:30', '02:00')],
      sat: [slot('12:00', '02:00')],
      sun: [slot('12:00', '20:00')],
    },
    initialStatus: 'OPEN',
  },
  {
    id: 'lst_ams_004',
    slug: 'nachtkebab-de-pijp-amsterdam',
    name: 'Nachtkebab De Pijp',
    timezone: 'Europe/Amsterdam',
    openingHours: everyDay(slot('18:00', '04:00')),
    initialStatus: 'CLOSED',
  },
  {
    id: 'lst_lon_005',
    slug: 'bagel-corner-shoreditch',
    name: 'Bagel Corner Shoreditch',
    timezone: 'Europe/London',
    openingHours: {
      mon: [slot('07:00', '15:00')],
      tue: [slot('07:00', '15:00')],
      wed: [slot('07:00', '15:00')],
      thu: [slot('07:00', '15:00')],
      fri: [slot('07:00', '15:00')],
      sat: [slot('08:00', '16:00')],
      sun: [slot('08:00', '16:00')],
    },
    initialStatus: 'PAUSED',
  },
];

export interface SeededListing {
  listing: PlatformListing;
  initialStatus: ListingStatus;
}

export function buildSeed(publicBaseUrl: string): SeededListing[] {
  const base = publicBaseUrl.replace(/\/+$/, '');
  return SEED.map(({ slug, initialStatus, ...listing }) => ({
    listing: { ...listing, listingUrl: `${base}/store/${slug}` },
    initialStatus,
  }));
}
