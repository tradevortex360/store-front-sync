import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { setupSwagger } from '../common/swagger.js';
import { platformMockDocs } from './platform-mock.docs.js';
import { PlatformMockModule } from './platform-mock.module.js';

async function bootstrap() {
  const app = await NestFactory.create(PlatformMockModule);
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  // So the combined Swagger UI on the api can load this spec and call this service.
  app.enableCors();
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  setupSwagger(
    app,
    'platform-mock',
    platformMockDocs(config.getOrThrow<string>('PLATFORM_PUBLIC_URL')),
  );
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  console.log(`platform-mock listening on :${port} (docs at /docs)`);
}
await bootstrap();
