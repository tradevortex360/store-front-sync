import { Controller, Get, Param, Res } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { z } from 'zod';
import { setTimeout as sleep } from 'node:timers/promises';
import { ChaosService } from '../chaos/chaos.service.js';
import {
  malformedListingsBodies,
  malformedStatusBodies,
  pick,
} from '../chaos/malformed-payloads.js';
import {
  errorBodySchema,
  listingSchema,
  listingStatusSchema,
} from './listings.schemas.js';
import { ListingsStore } from './listings.store.js';

const CHAOS_NOTE =
  '\n\n**Chaos:** this endpoint is subject to the chaos rules set via `/admin/chaos`. Depending on them, the response may be delayed by `latencyMs`, ' +
  'fail with `errorStatus` (default 503), or come back as `200` with a body that does not match the schema below.';

const injectedError = ApiResponse({
  status: '5XX',
  description:
    'Injected failure (`errorRate`). The status code is the configured `errorStatus`, which can be any 4xx/5xx.',
  standardSchema: errorBodySchema,
});

/** The public, platform-facing API that the worker polls. Subject to chaos. */
@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly store: ListingsStore,
    private readonly chaos: ChaosService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all restaurant listings',
    description:
      'Returns every listing with its timezone and weekly opening hours. The worker uses this to know which restaurants to check and when they should be open.' +
      CHAOS_NOTE +
      ' Malformed bodies here include an invalid IANA timezone, times like `25:99`, free-text hours, missing ids, a wrapped array and `null`.',
  })
  @ApiOkResponse({
    description: 'All listings (5 in the seed data).',
    standardSchema: z.array(listingSchema),
  })
  @injectedError
  async list(@Res() res: Response): Promise<void> {
    const decision = this.chaos.decide();
    await sleep(decision.delayMs);

    if (decision.fault === 'error') {
      res.status(decision.errorStatus).json({ error: 'Injected failure' });
    } else if (decision.fault === 'malformed') {
      res
        .status(200)
        .type('application/json')
        .send(
          pick(malformedListingsBodies(this.store.all()), this.chaos.random),
        );
    } else {
      res.status(200).json(this.store.all());
    }
  }

  @Get(':id/status')
  @ApiOperation({
    summary: 'Get the current status of one listing',
    description:
      'What the platform shows to customers right now: `OPEN`, `CLOSED` or `PAUSED`. ' +
      'The mock never derives this from opening hours; it changes only via `PUT /admin/listings/{id}/status` or a reset.' +
      CHAOS_NOTE +
      ' A per-listing override (`PUT /admin/chaos/listings/{id}`) takes precedence over the defaults. ' +
      'Malformed bodies include `{"status":"open"}`, unknown values, renamed fields, wrong types, truncated JSON, an HTML error page and an empty body.',
  })
  @ApiParam({
    name: 'id',
    description: 'Listing id from `GET /listings`.',
    example: 'lst_ber_001',
  })
  @ApiOkResponse({ standardSchema: listingStatusSchema })
  @ApiNotFoundResponse({
    description:
      'Unknown listing id. Returned immediately; chaos is not applied.',
    standardSchema: errorBodySchema,
  })
  @injectedError
  async status(@Param('id') id: string, @Res() res: Response): Promise<void> {
    if (!this.store.has(id)) {
      res.status(404).json({ error: `Listing ${id} not found` });
      return;
    }

    const decision = this.chaos.decide(id);
    await sleep(decision.delayMs);

    if (decision.fault === 'error') {
      res.status(decision.errorStatus).json({ error: 'Injected failure' });
    } else if (decision.fault === 'malformed') {
      res
        .status(200)
        .type('application/json')
        .send(pick(malformedStatusBodies(), this.chaos.random));
    } else {
      res.status(200).json({ status: this.store.getStatus(id) });
    }
  }
}
