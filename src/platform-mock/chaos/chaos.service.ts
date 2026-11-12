import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChaosRule {
  /** Added delay before responding, in ms. A large value simulates a hang/timeout. */
  latencyMs: number;
  /** Probability (0..1) of answering with an HTTP error. */
  errorRate: number;
  /** HTTP status used for injected errors. */
  errorStatus: number;
  /** Probability (0..1) of answering 200 with a malformed body. */
  malformedRate: number;
}

export interface ChaosState {
  /** Applies to every endpoint unless a listing override exists. */
  defaults: ChaosRule;
  /** Per-listing overrides for GET /listings/:id/status. */
  listings: Record<string, Partial<ChaosRule>>;
}

export type Fault = 'error' | 'malformed' | null;

export interface ChaosDecision {
  delayMs: number;
  fault: Fault;
  errorStatus: number;
}

/** Holds the misbehaviour configuration and decides, per request, how to misbehave. */
@Injectable()
export class ChaosService {
  private readonly startupDefaults: ChaosRule;
  private state: ChaosState;
  /** Source of randomness; replaceable in tests. */
  random: () => number = Math.random;

  constructor(config: ConfigService) {
    this.startupDefaults = {
      latencyMs: config.get<number>('CHAOS_LATENCY_MS') ?? 0,
      errorRate: config.get<number>('CHAOS_ERROR_RATE') ?? 0,
      errorStatus: 503,
      malformedRate: config.get<number>('CHAOS_MALFORMED_RATE') ?? 0,
    };
    this.state = this.initialState();
  }

  getState(): ChaosState {
    return structuredClone(this.state);
  }

  updateDefaults(patch: Partial<ChaosRule>): ChaosState {
    this.state.defaults = { ...this.state.defaults, ...patch };
    return this.getState();
  }

  updateListing(listingId: string, patch: Partial<ChaosRule>): ChaosState {
    this.state.listings[listingId] = {
      ...this.state.listings[listingId],
      ...patch,
    };
    return this.getState();
  }

  clearListing(listingId: string): ChaosState {
    delete this.state.listings[listingId];
    return this.getState();
  }

  /** Back to the env-var defaults with no listing overrides. */
  reset(): ChaosState {
    this.state = this.initialState();
    return this.getState();
  }

  ruleFor(listingId?: string): ChaosRule {
    const override = listingId ? this.state.listings[listingId] : undefined;
    return { ...this.state.defaults, ...override };
  }

  decide(listingId?: string): ChaosDecision {
    const rule = this.ruleFor(listingId);
    const roll = this.random();
    let fault: Fault = null;
    if (roll < rule.errorRate) fault = 'error';
    else if (roll < rule.errorRate + rule.malformedRate) fault = 'malformed';
    return { delayMs: rule.latencyMs, fault, errorStatus: rule.errorStatus };
  }

  private initialState(): ChaosState {
    return { defaults: { ...this.startupDefaults }, listings: {} };
  }
}
