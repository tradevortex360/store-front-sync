import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { ChaosService } from '../chaos/chaos.service.js';
import {
  malformedListingsBodies,
  malformedStatusBodies,
  pick,
} from '../chaos/malformed-payloads.js';
import { ListingsStore } from './listings.store.js';

/** The public, platform-facing API that the worker polls. Subject to chaos. */
@Controller('listings')
export class ListingsController {
  constructor(
    private readonly store: ListingsStore,
    private readonly chaos: ChaosService,
  ) {}

  @Get()
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
