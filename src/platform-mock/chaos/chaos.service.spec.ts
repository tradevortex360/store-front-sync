import type { ConfigService } from '@nestjs/config';
import { ChaosService } from './chaos.service.js';

const config = (values: Record<string, number>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('ChaosService', () => {
  it('starts from env defaults and behaves normally when rates are 0', () => {
    const chaos = new ChaosService(config({ CHAOS_LATENCY_MS: 250 }));
    expect(chaos.decide()).toEqual({
      delayMs: 250,
      fault: null,
      errorStatus: 503,
    });
  });

  it('splits the random roll into error, malformed and ok bands', () => {
    const chaos = new ChaosService(config({}));
    chaos.updateDefaults({ errorRate: 0.2, malformedRate: 0.3 });

    chaos.random = () => 0.1;
    expect(chaos.decide().fault).toBe('error');
    chaos.random = () => 0.4;
    expect(chaos.decide().fault).toBe('malformed');
    chaos.random = () => 0.6;
    expect(chaos.decide().fault).toBeNull();
  });

  it('applies listing overrides on top of defaults, only for that listing', () => {
    const chaos = new ChaosService(config({}));
    chaos.updateDefaults({ latencyMs: 100 });
    chaos.updateListing('a', { errorRate: 1, errorStatus: 500 });

    expect(chaos.decide('a')).toEqual({
      delayMs: 100,
      fault: 'error',
      errorStatus: 500,
    });
    expect(chaos.decide('b').fault).toBeNull();

    chaos.clearListing('a');
    expect(chaos.decide('a').fault).toBeNull();
  });

  it('reset restores env defaults and drops overrides', () => {
    const chaos = new ChaosService(config({ CHAOS_ERROR_RATE: 0.5 }));
    chaos.updateDefaults({ errorRate: 1 });
    chaos.updateListing('a', { latencyMs: 5000 });

    expect(chaos.reset()).toEqual({
      defaults: {
        latencyMs: 0,
        errorRate: 0.5,
        errorStatus: 503,
        malformedRate: 0,
      },
      listings: {},
    });
  });
});
