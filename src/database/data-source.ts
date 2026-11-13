import type { DataSourceOptions } from 'typeorm';
import { AvailabilityCheck } from './entities/availability-check.entity.js';
import { Listing } from './entities/listing.entity.js';
import { StatusCheck } from './entities/status-check.entity.js';
import { InitialSchema1794441600000 } from './migrations/1794441600000-InitialSchema.js';
import { Mismatches1794528000000 } from './migrations/1794528000000-Mismatches.js';
import { AvailabilityChecks1794614400000 } from './migrations/1794614400000-AvailabilityChecks.js';

export const entities = [Listing, StatusCheck, AvailabilityCheck];

/** Migrations are listed explicitly (no globs) so they resolve the same way from src and dist. */
export const migrations = [
  InitialSchema1794441600000,
  Mismatches1794528000000,
  AvailabilityChecks1794614400000,
];

/** Single source of truth for DB options, shared by the Nest apps and the migrate entry point. */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities,
    migrations,
    migrationsTableName: 'typeorm_migrations',
    // Schema changes only ever happen through migrations.
    synchronize: false,
    migrationsRun: false,
  };
}
