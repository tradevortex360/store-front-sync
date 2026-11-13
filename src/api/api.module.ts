import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { apiEnvSchema, parseEnv } from '../common/env.js';
import { DatabaseModule } from '../database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { MismatchesController } from './mismatches/mismatches.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (env) => parseEnv(apiEnvSchema, env),
    }),
    DatabaseModule,
    TerminusModule,
  ],
  controllers: [HealthController, MismatchesController],
})
export class ApiModule {}
