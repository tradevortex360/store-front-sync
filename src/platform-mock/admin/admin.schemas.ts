import { z } from 'zod';
import { LISTING_STATUSES } from '../../common/listing.types.js';

const rate = z.number().min(0).max(1);

const chaosRuleFields = {
  latencyMs: z
    .number()
    .int()
    .min(0)
    .max(120_000)
    .describe(
      'Delay added before every affected response, in ms. Use a value above your client timeout to simulate a hanging platform.',
    )
    .meta({ example: 3000 }),
  errorRate: rate
    .describe(
      'Probability (0–1) that an affected request is answered with `errorStatus`.',
    )
    .meta({ example: 0.3 }),
  errorStatus: z
    .number()
    .int()
    .min(400)
    .max(599)
    .describe('HTTP status used for injected errors.')
    .meta({ example: 502 }),
  malformedRate: rate
    .describe(
      'Probability (0–1) that an affected request is answered `200` with a body that breaks the contract (wrong casing, unknown enum, wrong types, truncated JSON, HTML, empty body, …).',
    )
    .meta({ example: 0.2 }),
};

/** Request body for PUT /admin/chaos and PUT /admin/chaos/listings/:id. */
export const chaosPatchSchema = z
  .object(chaosRuleFields)
  .partial()
  .strict()
  .refine(
    (rule) => (rule.errorRate ?? 0) + (rule.malformedRate ?? 0) <= 1,
    'errorRate + malformedRate must not exceed 1',
  )
  .meta({
    id: 'ChaosRulePatch',
    description:
      'Partial chaos rule. Only the fields you send change; the rest keep their current value. Unknown fields are rejected, and `errorRate + malformedRate` must not exceed 1.',
    example: { latencyMs: 0, errorRate: 0.3, errorStatus: 502 },
  });

export const chaosRuleSchema = z
  .object(chaosRuleFields)
  .meta({ id: 'ChaosRule', description: 'A complete chaos rule.' });

export const chaosStateSchema = z
  .object({
    defaults: chaosRuleSchema.describe(
      'Rule applied to every public endpoint.',
    ),
    listings: z
      .record(z.string(), chaosRuleSchema.partial())
      .describe(
        'Per-listing overrides, keyed by listing id. They apply on top of `defaults`, and only to that listing’s `GET /listings/{id}/status`.',
      )
      .meta({ example: { lst_hel_003: { malformedRate: 1 } } }),
  })
  .meta({ id: 'ChaosState' });

const statusesSchema = z
  .record(z.string(), z.enum(LISTING_STATUSES))
  .describe('Current status of every listing, keyed by listing id.')
  .meta({
    example: {
      lst_ber_001: 'OPEN',
      lst_vie_002: 'OPEN',
      lst_hel_003: 'OPEN',
      lst_ams_004: 'CLOSED',
      lst_lon_005: 'PAUSED',
    },
  });

export const adminStateSchema = z
  .object({ chaos: chaosStateSchema, statuses: statusesSchema })
  .meta({ id: 'AdminState', description: 'Full mock state.' });

/** Request body for PUT /admin/listings/:id/status. */
export const statusBodySchema = z
  .object({
    status: z
      .enum(LISTING_STATUSES)
      .describe('Status the listing will report from now on.'),
  })
  .strict()
  .meta({ id: 'SetListingStatus', example: { status: 'PAUSED' } });

export const statusChangedSchema = z
  .object({
    id: z.string().meta({ example: 'lst_ber_001' }),
    status: z.enum(LISTING_STATUSES).meta({ example: 'PAUSED' }),
  })
  .meta({ id: 'ListingStatusChanged' });

export { nestErrorSchema } from '../../common/http-error.schema.js';
