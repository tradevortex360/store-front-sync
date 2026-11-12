import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { setupSwagger } from '../common/swagger.js';
import { apiDocs } from './api.docs.js';
import { ApiModule } from './api.module.js';

async function bootstrap() {
  const app = await NestFactory.create(ApiModule);
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  setupSwagger(
    app,
    'api',
    apiDocs(
      config.getOrThrow<string>('API_PUBLIC_URL'),
      config.getOrThrow<string>('PLATFORM_MOCK_PUBLIC_URL'),
    ),
  );
  await app.listen(port, '0.0.0.0');
  console.log(`api listening on :${port} (docs at /docs)`);
}
await bootstrap();
