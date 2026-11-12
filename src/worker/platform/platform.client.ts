import { z } from 'zod';
import type {
  ListingStatus,
  PlatformListing,
} from '../../common/listing.types.js';
import type { CheckOutcome } from '../../database/entities/status-check.entity.js';
// The platform contract. The mock's docs and the worker's validation use the same schemas.
import {
  listingSchema,
  listingStatusSchema,
} from '../../platform-mock/listings/listings.schemas.js';
import { isValidTimezone } from '../availability/opening-hours.js';

/** What the worker accepts as a listing: the contract plus a timezone Intl actually knows. */
const workerListingSchema = listingSchema.extend({
  timezone: z.string().refine(isValidTimezone, 'unknown IANA timezone'),
});

/** A request to the platform that did not produce a usable answer. */
export class PlatformRequestError extends Error {
  constructor(
    readonly outcome: Exclude<CheckOutcome, 'ok'>,
    message: string,
    readonly httpStatus: number | null,
    readonly latencyMs: number,
  ) {
    super(message);
    this.name = 'PlatformRequestError';
  }
}

export type StatusResult =
  | {
      outcome: 'ok';
      status: ListingStatus;
      httpStatus: number;
      latencyMs: number;
    }
  | {
      outcome: Exclude<CheckOutcome, 'ok'>;
      status: null;
      httpStatus: number | null;
      latencyMs: number;
      error: string;
    };

export interface ListingsResult {
  listings: PlatformListing[];
  /** Entries that broke the contract; skipped, so one bad listing can't block the rest. */
  rejected: { index: number; id?: unknown; error: string }[];
}

type FetchFn = typeof fetch;

/** HTTP client for the delivery platform's public API. Never trusts a response body. */
export class PlatformClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  /** `GET /listings`. Throws `PlatformRequestError` if the list as a whole is unusable. */
  async fetchListings(): Promise<ListingsResult> {
    const { body, httpStatus, latencyMs } = await this.getJson('/listings');
    if (!Array.isArray(body)) {
      throw new PlatformRequestError(
        'invalid_payload',
        `expected an array of listings, got ${describe(body)}`,
        httpStatus,
        latencyMs,
      );
    }
    const result: ListingsResult = { listings: [], rejected: [] };
    body.forEach((item: unknown, index) => {
      const parsed = workerListingSchema.safeParse(item);
      if (parsed.success) result.listings.push(parsed.data);
      else
        result.rejected.push({
          index,
          id: (item as { id?: unknown } | null)?.id,
          error: z.prettifyError(parsed.error),
        });
    });
    return result;
  }

  /** `GET /listings/:id/status`. Never throws: every failure becomes an outcome. */
  async fetchStatus(listingId: string): Promise<StatusResult> {
    try {
      const { body, httpStatus, latencyMs } = await this.getJson(
        `/listings/${encodeURIComponent(listingId)}/status`,
      );
      const parsed = listingStatusSchema.safeParse(body);
      if (!parsed.success) {
        return {
          outcome: 'invalid_payload',
          status: null,
          httpStatus,
          latencyMs,
          error: `${z.prettifyError(parsed.error)} (body: ${truncate(JSON.stringify(body))})`,
        };
      }
      return {
        outcome: 'ok',
        status: parsed.data.status,
        httpStatus,
        latencyMs,
      };
    } catch (err) {
      if (err instanceof PlatformRequestError) {
        return {
          outcome: err.outcome,
          status: null,
          httpStatus: err.httpStatus,
          latencyMs: err.latencyMs,
          error: err.message,
        };
      }
      throw err;
    }
  }

  private async getJson(
    path: string,
  ): Promise<{ body: unknown; httpStatus: number; latencyMs: number }> {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    let httpStatus: number | null = null;
    let text: string;
    try {
      // The timeout covers headers and body, so a slow body counts as a timeout too.
      const res = await this.fetchFn(new URL(path, this.baseUrl), {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { accept: 'application/json' },
      });
      httpStatus = res.status;
      text = await res.text();
      if (!res.ok) {
        throw new PlatformRequestError(
          'http_error',
          `HTTP ${res.status}: ${truncate(text)}`,
          httpStatus,
          elapsed(),
        );
      }
    } catch (err) {
      if (err instanceof PlatformRequestError) throw err;
      const e = err as Error & { cause?: Error };
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        throw new PlatformRequestError(
          'timeout',
          `no complete response within ${this.timeoutMs} ms`,
          httpStatus,
          elapsed(),
        );
      }
      throw new PlatformRequestError(
        'network_error',
        e.cause?.message ? `${e.message}: ${e.cause.message}` : e.message,
        httpStatus,
        elapsed(),
      );
    }

    try {
      return { body: JSON.parse(text), httpStatus, latencyMs: elapsed() };
    } catch {
      throw new PlatformRequestError(
        'invalid_payload',
        `response is not JSON: ${truncate(text) || '(empty body)'}`,
        httpStatus,
        elapsed(),
      );
    }
  }
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
