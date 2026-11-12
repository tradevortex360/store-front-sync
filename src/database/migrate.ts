import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseEnvSchema, parseEnv } from '../common/env.js';
import { buildDataSourceOptions } from './data-source.js';

/**
 * One-shot entry point: applies pending migrations and exits.
 * Runs as the `migrate` service in docker compose before api (and later worker) start.
 */
async function migrate(): Promise<void> {
  const { DATABASE_URL } = parseEnv(databaseEnvSchema);
  const dataSource = new DataSource(buildDataSourceOptions(DATABASE_URL));
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length
        ? `Applied ${applied.length} migration(s): ${applied.map((m) => m.name).join(', ')}`
        : 'Database schema is up to date.',
    );
  } finally {
    await dataSource.destroy();
  }
}

try {
  await migrate();
} catch (error) {
  console.error('Migration failed:', error);
  process.exitCode = 1;
}
