import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

export const DOCS_PATH = 'docs';
export const DOCS_JSON_PATH = 'docs-json';

export interface SwaggerSetup {
  title: string;
  description: string;
  /** Public base URL of this service, used for "Try it out". */
  serverUrl: string;
  tags: { name: string; description: string }[];
  /**
   * Other services' OpenAPI documents to offer in the same Swagger UI, as a
   * spec dropdown. This service's own document is always listed first.
   */
  alsoShow?: { name: string; url: string }[];
}

export function buildOpenApiDocument(
  app: INestApplication,
  setup: SwaggerSetup,
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle(setup.title)
    .setDescription(setup.description)
    .setVersion('1.0.0')
    .addServer(setup.serverUrl);
  for (const tag of setup.tags) builder.addTag(tag.name, tag.description);
  return SwaggerModule.createDocument(app, builder.build());
}

/**
 * Serves Swagger UI at /docs and the raw OpenAPI document at /docs-json.
 * Request bodies are documented from the same Zod schemas that validate them,
 * so the docs can't drift from the validation.
 */
export function setupSwagger(
  app: INestApplication,
  name: string,
  setup: SwaggerSetup,
): void {
  const document = buildOpenApiDocument(app, setup);
  const urls = setup.alsoShow?.length
    ? [{ name, url: `/${DOCS_JSON_PATH}` }, ...setup.alsoShow]
    : undefined;
  SwaggerModule.setup(DOCS_PATH, app, document, {
    jsonDocumentUrl: DOCS_JSON_PATH,
    customSiteTitle: `${setup.title} – API docs`,
    explorer: !!urls,
    swaggerOptions: {
      ...(urls ? { urls, 'urls.primaryName': name } : {}),
      docExpansion: 'list',
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
  });
}
