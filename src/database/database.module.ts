import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildDataSourceOptions } from './data-source.js';

/** TypeORM connection for any Nest app that needs the database (api, worker). */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions(config.getOrThrow<string>('DATABASE_URL')),
        retryAttempts: 10,
        retryDelay: 2000,
      }),
    }),
  ],
})
export class DatabaseModule {}
