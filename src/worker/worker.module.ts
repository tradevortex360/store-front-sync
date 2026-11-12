import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { parseEnv, workerEnvSchema } from '../common/env.js';
import { DatabaseModule } from '../database/database.module.js';
import { AvailabilityChecker } from './availability/availability-checker.service.js';
import { CheckScheduler } from './check-scheduler.service.js';
import { PlatformClient } from './platform/platform.client.js';

/** Background worker: no HTTP server, just the check loop. */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (env) => parseEnv(workerEnvSchema, env),
    }),
    DatabaseModule,
  ],
  providers: [
    {
      provide: PlatformClient,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new PlatformClient(
          config.getOrThrow<string>('PLATFORM_BASE_URL'),
          config.getOrThrow<number>('REQUEST_TIMEOUT_MS'),
        ),
    },
    {
      provide: AvailabilityChecker,
      inject: [PlatformClient, DataSource],
      useFactory: (platform: PlatformClient, dataSource: DataSource) =>
        new AvailabilityChecker(platform, dataSource),
    },
    {
      provide: CheckScheduler,
      inject: [AvailabilityChecker, ConfigService],
      useFactory: (checker: AvailabilityChecker, config: ConfigService) =>
        new CheckScheduler(
          checker,
          config.getOrThrow<number>('CHECK_INTERVAL_SECONDS'),
        ),
    },
  ],
})
export class WorkerModule {}
