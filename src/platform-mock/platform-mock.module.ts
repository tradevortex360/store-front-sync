import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseEnv, platformMockEnvSchema } from '../common/env.js';
import { AdminController } from './admin/admin.controller.js';
import { ChaosService } from './chaos/chaos.service.js';
import { ListingsController } from './listings/listings.controller.js';
import { ListingsStore } from './listings/listings.store.js';

/** Liveness for docker compose; never affected by chaos. */
@ApiTags('Health')
@Controller('health')
class MockHealthController {
  @Get()
  @ApiOperation({
    summary: 'Liveness check',
    description:
      'Returns 200 as long as the process is up. Used by the docker compose healthcheck. Never affected by chaos.',
  })
  @ApiOkResponse({
    standardSchema: z.object({ status: z.literal('ok') }),
  })
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
