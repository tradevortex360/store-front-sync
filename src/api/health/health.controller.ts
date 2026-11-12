import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod';

/** Terminus health response, for the docs. */
const healthSchema = (status: 'ok' | 'error', db: 'up' | 'down') => {
  const indicator = z.object({
    database: z.object({
      status: z.literal(db),
      ...(db === 'down'
        ? {
            message: z.string().meta({ example: 'timeout of 1500ms exceeded' }),
          }
        : {}),
    }),
  });
  return z
    .object({
      status: z
        .literal(status)
        .describe('`ok` when every indicator is up, otherwise `error`.'),
      info: indicator
        .partial()
        .describe('Indicators that are up (empty when all are down).'),
      error: indicator
        .partial()
        .describe('Indicators that are down (empty when all are up).'),
      details: indicator.describe('Every indicator, up or down.'),
    })
    .meta({ id: status === 'ok' ? 'HealthOk' : 'HealthError' });
};

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** 200 when the API is up and the database answers; 503 otherwise. */
  @Get()
  @HealthCheck({ swaggerDocumentation: false })
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Pings PostgreSQL (`SELECT 1`, 1.5 s timeout). Returns 200 when the API is up and the database answers, 503 otherwise. ' +
      'Use it as the readiness probe: a 503 means the API is running but cannot serve data.',
  })
  @ApiOkResponse({
    description: 'API and database are up.',
    standardSchema: healthSchema('ok', 'up'),
  })
  @ApiServiceUnavailableResponse({
    description:
      'The database did not answer in time or refused the connection. `error.database.message` says why.',
    standardSchema: healthSchema('error', 'down'),
  })
  check() {
    return this.health.check([
      () => this.db.pingCheck('database').withTimeout(1500),
    ]);
  }
}
