import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parseEnv, platformMockEnvSchema } from '../common/env.js';
import { AdminController } from './admin/admin.controller.js';
import { ChaosService } from './chaos/chaos.service.js';
import { ListingsController } from './listings/listings.controller.js';
import { ListingsStore } from './listings/listings.store.js';

/** Liveness for docker compose; never affected by chaos. */
@Controller('health')
class MockHealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: (env) => parseEnv(platformMockEnvSchema, env),
    }),
  ],
  controllers: [ListingsController, AdminController, MockHealthController],
  providers: [ListingsStore, ChaosService],
})
export class PlatformMockModule {}
