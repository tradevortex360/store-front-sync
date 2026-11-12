import { z } from 'zod';
import { LISTING_STATUSES } from '../../common/listing.types.js';

/**
 * Response shapes of the public platform API, as Zod schemas. Used for the
 * OpenAPI docs; they describe the contract the worker relies on.
 */

const localTime = (example: string) =>
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .meta({ example });

export const timeSlotSchema = z
  .object({
    open: localTime('11:00').describe(
      'Opening time, HH:mm, in the listing timezone.',
    ),
    close: localTime('22:00').describe(
      'Closing time, HH:mm, in the listing timezone. A value earlier than `open` means the slot runs past midnight into the next day (e.g. 18:00 → 04:00).',
    ),
  })
  .meta({ id: 'TimeSlot', description: 'One continuous opening period.' });

const daySlots = (day: string) =>
  z
    .array(timeSlotSchema)
    .describe(
      `Opening periods that start on ${day}. Empty list = closed all day. Several entries = split shifts.`,
    );

export const openingHoursSchema = z
  .object({
    mon: daySlots('Monday'),
    tue: daySlots('Tuesday'),
    wed: daySlots('Wednesday'),
    thu: daySlots('Thursday'),
    fri: daySlots('Friday'),
    sat: daySlots('Saturday'),
    sun: daySlots('Sunday'),
  })
  .meta({
    id: 'OpeningHours',
    description:
      'Weekly opening hours in local time. All seven keys are always present.',
  });

export const listingSchema = z
  .object({
    id: z
      .string()
      .describe('Stable platform listing id.')
      .meta({ example: 'lst_ber_001' }),
    name: z
      .string()
      .describe('Restaurant name as shown on the platform.')
      .meta({ example: 'Curry Kontor Berlin-Mitte' }),
    timezone: z
      .string()
      .describe(
        'IANA timezone the opening hours are expressed in. Needed to decide what "now" means for this restaurant.',
      )
      .meta({ example: 'Europe/Berlin' }),
    listingUrl: z
      .url()
      .describe('Public URL of the store page on the platform.')
      .meta({
        example: 'http://localhost:4000/store/curry-kontor-berlin-mitte',
      }),
    openingHours: openingHoursSchema,
  })
  .meta({
    id: 'Listing',
    description: 'A restaurant listing on the delivery platform.',
  });

export const listingStatusSchema = z
  .object({
    status: z
      .enum(LISTING_STATUSES)
      .describe(
        'What the platform currently shows to customers. `OPEN`: accepting orders. `CLOSED`: outside opening hours (as the platform sees it). `PAUSED`: temporarily switched off by the restaurant or platform, e.g. busy kitchen or tablet offline.',
      ),
  })
  .meta({ id: 'ListingStatus', example: { status: 'OPEN' } });

export const errorBodySchema = z
  .object({
    error: z.string().meta({ example: 'Listing lst_xyz not found' }),
  })
  .meta({
    id: 'MockError',
    description: 'Error body returned by the public platform endpoints.',
  });
