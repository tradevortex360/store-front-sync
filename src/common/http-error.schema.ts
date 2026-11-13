import { z } from 'zod';

/** Error body NestJS sends for HttpExceptions, as documented in every service's OpenAPI. */
export const nestErrorSchema = z
  .object({
    statusCode: z.number().int().meta({ example: 404 }),
    message: z.unknown().meta({ example: 'Listing lst_xyz not found' }),
    error: z.string().optional().meta({ example: 'Not Found' }),
  })
  .meta({
    id: 'HttpError',
    description:
      'Standard NestJS error body. For validation errors (400), `message` lists the problems.',
  });
