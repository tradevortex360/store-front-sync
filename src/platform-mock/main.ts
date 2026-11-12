import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { PlatformMockModule } from './platform-mock.module.js';

async function bootstrap() {
  const app = await NestFactory.create(PlatformMockModule);
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  console.log(`platform-mock listening on :${port}`);
}
await bootstrap();
