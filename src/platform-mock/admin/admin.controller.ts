import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { z } from 'zod';
import { LISTING_STATUSES } from '../../common/listing.types.js';
import { ChaosService, type ChaosRule } from '../chaos/chaos.service.js';
import { ListingsStore } from '../listings/listings.store.js';

const rate = z.number().min(0).max(1);

const chaosPatchSchema = z
  .object({
    latencyMs: z.number().int().min(0).max(120_000),
    errorRate: rate,
    errorStatus: z.number().int().min(400).max(599),
    malformedRate: rate,
  })
  .partial()
  .strict()
  .refine(
    (rule) => (rule.errorRate ?? 0) + (rule.malformedRate ?? 0) <= 1,
    'errorRate + malformedRate must not exceed 1',
  );

const statusBodySchema = z
  .object({ status: z.enum(LISTING_STATUSES) })
  .strict();

/**
 * Control plane for the mock. Not affected by chaos, so you can always
 * reconfigure it, even while the public endpoints are misbehaving.
 */
@Controller('admin')
export class AdminController {
  constructor(
    private readonly chaos: ChaosService,
    private readonly store: ListingsStore,
  ) {}

  @Get('state')
  state() {
    return { chaos: this.chaos.getState(), statuses: this.store.allStatuses() };
  }

  /** Change the default rule for every endpoint, e.g. `{ "latencyMs": 3000 }`. */
  @Put('chaos')
  updateDefaults(
    @Body({ schema: chaosPatchSchema }) patch: Partial<ChaosRule>,
  ) {
    return this.chaos.updateDefaults(patch);
  }

  /** Override the rule for one listing's status endpoint only. */
  @Put('chaos/listings/:id')
  updateListing(
    @Param('id') id: string,
    @Body({ schema: chaosPatchSchema }) patch: Partial<ChaosRule>,
  ) {
    this.assertListing(id);
    return this.chaos.updateListing(id, patch);
  }

  @Delete('chaos/listings/:id')
  clearListing(@Param('id') id: string) {
    this.assertListing(id);
    return this.chaos.clearListing(id);
  }

  /** Force the status a listing reports, e.g. PAUSED during opening hours. */
  @Put('listings/:id/status')
  setStatus(
    @Param('id') id: string,
    @Body({ schema: statusBodySchema }) body: z.infer<typeof statusBodySchema>,
  ) {
    this.store.setStatus(id, body.status);
    return { id, status: body.status };
  }

  /** Back to env-var chaos defaults and seeded statuses. */
  @Post('reset')
  @HttpCode(200)
  reset() {
    this.store.resetStatuses();
    return { chaos: this.chaos.reset(), statuses: this.store.allStatuses() };
  }

  private assertListing(id: string): void {
    if (!this.store.has(id))
      throw new NotFoundException(`Listing ${id} not found`);
  }
}
