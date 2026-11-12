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
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { z } from 'zod';
import { ChaosService, type ChaosRule } from '../chaos/chaos.service.js';
import { ListingsStore } from '../listings/listings.store.js';
import {
  adminStateSchema,
  chaosPatchSchema,
  chaosStateSchema,
  nestErrorSchema,
  statusBodySchema,
  statusChangedSchema,
} from './admin.schemas.js';

const listingIdParam = ApiParam({
  name: 'id',
  description: 'Listing id, e.g. `lst_ber_001`.',
  example: 'lst_ber_001',
});
const unknownListing = ApiNotFoundResponse({
  description: 'No listing with this id.',
  standardSchema: nestErrorSchema,
});
const invalidBody = ApiBadRequestResponse({
  description:
    'Body failed validation: wrong type, out of range, unknown field, or errorRate + malformedRate > 1.',
  standardSchema: nestErrorSchema,
});

/**
 * Control plane for the mock. Not affected by chaos, so you can always
 * reconfigure it, even while the public endpoints are misbehaving.
 */
@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly chaos: ChaosService,
    private readonly store: ListingsStore,
  ) {}

  @Get('state')
  @ApiOperation({
    summary: 'Get the current mock state',
    description:
      'Returns the active chaos configuration (defaults and per-listing overrides) and the status every listing currently reports.',
  })
  @ApiOkResponse({ standardSchema: adminStateSchema })
  state() {
    return { chaos: this.chaos.getState(), statuses: this.store.allStatuses() };
  }

  @Put('chaos')
  @ApiOperation({
    summary: 'Change the default chaos rule',
    description:
      'Merges the given fields into the default rule, which applies to every public endpoint (`GET /listings` and every `GET /listings/{id}/status`). ' +
      'Takes effect on the next request; no restart needed.\n\n' +
      'Examples: `{ "latencyMs": 5000 }` to test timeouts, `{ "errorRate": 0.3, "errorStatus": 502 }` for flaky 5xx, `{ "malformedRate": 0.2 }` for contract breaks. ' +
      'Send `{ "latencyMs": 0, "errorRate": 0, "malformedRate": 0 }` to switch everything off again.',
  })
  @ApiOkResponse({
    description: 'The new chaos state.',
    standardSchema: chaosStateSchema,
  })
  @invalidBody
  updateDefaults(
    @Body({ schema: chaosPatchSchema }) patch: Partial<ChaosRule>,
  ) {
    return this.chaos.updateDefaults(patch);
  }

  @Put('chaos/listings/:id')
  @ApiOperation({
    summary: 'Override the chaos rule for one listing',
    description:
      'Merges the given fields into this listing’s override. The override sits on top of the defaults and applies only to `GET /listings/{id}/status` for this listing; `GET /listings` and other listings are unaffected. ' +
      'Repeated calls merge into the existing override.',
  })
  @listingIdParam
  @ApiOkResponse({
    description: 'The new chaos state.',
    standardSchema: chaosStateSchema,
  })
  @invalidBody
  @unknownListing
  updateListing(
    @Param('id') id: string,
    @Body({ schema: chaosPatchSchema }) patch: Partial<ChaosRule>,
  ) {
    this.assertListing(id);
    return this.chaos.updateListing(id, patch);
  }

  @Delete('chaos/listings/:id')
  @ApiOperation({
    summary: 'Remove a listing’s chaos override',
    description:
      'The listing falls back to the default rule. Succeeds even when the listing has no override.',
  })
  @listingIdParam
  @ApiOkResponse({
    description: 'The new chaos state.',
    standardSchema: chaosStateSchema,
  })
  @unknownListing
  clearListing(@Param('id') id: string) {
    this.assertListing(id);
    return this.chaos.clearListing(id);
  }

  @Put('listings/:id/status')
  @ApiOperation({
    summary: 'Force the status a listing reports',
    description:
      'Statuses never change by themselves: the mock does not apply opening hours. Use this to stage a scenario, e.g. set a listing to `PAUSED` during its opening hours to produce a mismatch, or `OPEN` at night. ' +
      'The value stays until changed again or `POST /admin/reset`.',
  })
  @listingIdParam
  @ApiOkResponse({
    description: 'The status now reported.',
    standardSchema: statusChangedSchema,
  })
  @ApiBadRequestResponse({
    description: 'Status is not one of OPEN, CLOSED, PAUSED.',
    standardSchema: nestErrorSchema,
  })
  @unknownListing
  setStatus(
    @Param('id') id: string,
    @Body({ schema: statusBodySchema }) body: z.infer<typeof statusBodySchema>,
  ) {
    this.store.setStatus(id, body.status);
    return { id, status: body.status };
  }

  @Post('reset')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset the mock',
    description:
      'Restores the chaos defaults from the env vars (`CHAOS_LATENCY_MS`, `CHAOS_ERROR_RATE`, `CHAOS_MALFORMED_RATE`), removes every per-listing override, and puts every listing back to its seeded status.',
  })
  @ApiOkResponse({
    description: 'The state after the reset.',
    standardSchema: adminStateSchema,
  })
  reset() {
    this.store.resetStatuses();
    return { chaos: this.chaos.reset(), statuses: this.store.allStatuses() };
  }

  private assertListing(id: string): void {
    if (!this.store.has(id))
      throw new NotFoundException(`Listing ${id} not found`);
  }
}
