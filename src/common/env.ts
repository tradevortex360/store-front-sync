import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const rate = z.coerce.number().min(0).max(1);

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export const apiEnvSchema = databaseEnvSchema.extend({
  PORT: port.default(3000),
});

export const platformMockEnvSchema = z.object({
  PORT: port.default(4000),
  /** Public base URL used to build each listing's listingUrl. */
  PLATFORM_PUBLIC_URL: z.url().default('http://localhost:4000'),
  /** Chaos defaults applied at startup; can be changed at runtime via /admin/chaos. */
  CHAOS_LATENCY_MS: z.coerce.number().int().min(0).default(0),
  CHAOS_ERROR_RATE: rate.default(0),
  CHAOS_MALFORMED_RATE: rate.default(0),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type PlatformMockEnv = z.infer<typeof platformMockEnvSchema>;

/** Parses env vars against a schema and fails fast with a readable message. */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  env: Record<string, unknown> = process.env,
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
