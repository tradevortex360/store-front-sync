import { z } from 'zod';
import { LISTING_STATUSES } from '../../common/listing.types.js';
import { MISMATCH_KINDS } from '../../database/entities/availability-check.entity.js';

export const MAX_LIMIT = 500;
export const DEFAULT_LIMIT = 100;

const isoTime = z.iso.datetime({ offset: true });

/** Query string of `GET /mismatches`. Unknown parameters are rejected, so typos don't silently match everything. */
export const mismatchesQuerySchema = z
  .strictObject({
    listingId: z.string().min(1).optional(),
    kind: z.enum(MISMATCH_KINDS).optional(),
    from: isoTime.optional(),
    to: isoTime.optional(),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine((q) => !q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), {
    message: '`from` must not be later than `to`',
    path: ['from'],
  });
export type MismatchesQuery = z.infer<typeof mismatchesQuerySchema>;

export const mismatchSchema = z
  .object({
    id: z
      .string()
      .describe('Row id in `availability_checks` (bigint, sent as a string).')
      .meta({ example: '42' }),
    listingId: z
      .string()
      .describe('Platform listing id.')
      .meta({ example: 'lst_ber_001' }),
    checkedAt: z.iso
      .datetime()
      .describe('When the worker asked the platform for the status.')
      .meta({ example: '2026-11-13T11:00:00.012Z' }),
    comparedAt: z.iso
      .datetime()
      .describe(
        'When the worker compared the status with the opening hours, right after the platform answered. The opening hours are evaluated at this time.',
      )
      .meta({ example: '2026-11-13T11:00:00.087Z' }),
    expectedOpen: z
      .boolean()
      .describe('What the opening hours say: should the listing be open?')
      .meta({ example: true }),
    actualStatus: z
      .enum(LISTING_STATUSES)
      .describe('What the platform showed to customers.')
      .meta({ example: 'PAUSED' }),
    kind: z
      .enum(MISMATCH_KINDS)
      .describe(
        '`open_outside_hours`: orderable although closed. `closed_during_hours` / `paused_during_hours`: should be open but customers cannot order.',
      )
      .meta({ example: 'paused_during_hours' }),
  })
  .meta({
    id: 'Mismatch',
    description:
      'One comparison where the platform status contradicted the opening hours.',
  });

export const mismatchPageSchema = z
  .object({
    total: z
      .number()
      .int()
      .describe('Number of mismatches matching the filters, over all pages.')
      .meta({ example: 3 }),
    limit: z.number().int().meta({ example: DEFAULT_LIMIT }),
    offset: z.number().int().meta({ example: 0 }),
    items: z
      .array(mismatchSchema)
      .describe('Newest first (by `comparedAt`, then `id`).'),
  })
  .meta({ id: 'MismatchPage' });
export type MismatchPage = z.infer<typeof mismatchPageSchema>;
