import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { AvailabilityChecker } from './availability/availability-checker.service.js';

/**
 * Starts a check round every `intervalSeconds`, measured from the start of one
 * round to the start of the next. Rounds never overlap: if one takes longer than the
 * interval, the next starts as soon as it finishes. A failing round is logged and the
 * schedule carries on.
 */
@Injectable()
export class CheckScheduler
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(CheckScheduler.name);
  private readonly stop = new AbortController();
  private loop?: Promise<void>;

  constructor(
    private readonly checker: AvailabilityChecker,
    private readonly intervalSeconds: number,
  ) {}

  onApplicationBootstrap() {
    this.logger.log(`checking every ${this.intervalSeconds} s`);
    this.loop = this.run();
  }

  /** On SIGTERM: let the current round finish (so its rows are written), then exit. */
  async beforeApplicationShutdown() {
    this.stop.abort();
    await this.loop;
  }

  private async run() {
    const intervalMs = this.intervalSeconds * 1000;
    while (!this.stop.signal.aborted) {
      const started = Date.now();
      try {
        await this.checker.runRound();
      } catch (err) {
        this.logger.error(
          `round failed: ${(err as Error).stack ?? String(err)}`,
        );
      }
      const wait = Math.max(0, intervalMs - (Date.now() - started));
      try {
        await sleep(wait, undefined, { signal: this.stop.signal });
      } catch {
        // Aborted by shutdown.
      }
    }
  }
}
