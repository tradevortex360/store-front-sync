import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  // No HTTP server: an application context is enough for DI, config and the DB.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // SIGTERM from `docker compose stop` → finish the current round, close the DB.
  app.enableShutdownHooks();
}
await bootstrap();
