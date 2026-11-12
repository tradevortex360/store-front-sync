import type { INestApplication, Type } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { writeFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { buildOpenApiDocument } from '../src/common/swagger.js';

/**
 * Builds the OpenAPI documents the services serve at /docs-json and checks
 * every operation is properly documented. Nothing listens and no DB is used.
 */

process.env.DATABASE_URL ??= 'postgres://unused:unused@localhost:5432/unused';
const { ApiModule } = await import('../src/api/api.module.js');
const { apiDocs } = await import('../src/api/api.docs.js');
const { PlatformMockModule } =
  await import('../src/platform-mock/platform-mock.module.js');
const { platformMockDocs } =
  await import('../src/platform-mock/platform-mock.docs.js');

async function documentFor(
  module: Type,
  setup: Parameters<typeof buildOpenApiDocument>[1],
): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({ imports: [module] })
    // The api's TypeORM connection is irrelevant for docs; don't try to connect.
    .overrideProvider(DataSource)
    .useValue({})
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  try {
    return buildOpenApiDocument(app, setup);
  } finally {
    await app.close();
  }
}

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

function operations(doc: OpenAPIObject) {
  return Object.entries(doc.paths).flatMap(([path, item]) =>
    METHODS.filter((m) => item[m]).map((m) => ({
      route: `${m.toUpperCase()} ${path}`,
      op: item[m]!,
    })),
  );
}

describe.each([
  {
    name: 'api',
    build: () =>
      documentFor(
        ApiModule,
        apiDocs('http://localhost:3000', 'http://localhost:4000'),
      ),
  },
  {
    name: 'platform-mock',
    build: () =>
      documentFor(
        PlatformMockModule,
        platformMockDocs('http://localhost:4000'),
      ),
  },
])('OpenAPI document: $name', ({ name, build }) => {
  let doc: OpenAPIObject;
  beforeAll(async () => {
    doc = await build();
    if (process.env.DUMP_OPENAPI)
      writeFileSync(
        `${process.env.DUMP_OPENAPI}/${name}.json`,
        JSON.stringify(doc, null, 2),
      );
  });

  it('documents every operation with a summary, description, tag and 2xx response', () => {
    const ops = operations(doc);
    expect(ops.length).toBeGreaterThan(0);
    for (const { route, op } of ops) {
      expect(op.summary, route).toBeTruthy();
      expect(op.description, route).toBeTruthy();
      expect(op.tags, route).toHaveLength(1);
      const ok = Object.entries(op.responses).find(([s]) =>
        s.startsWith('2'),
      )?.[1] as { content?: Record<string, { schema?: unknown }> } | undefined;
      expect(ok?.content?.['application/json']?.schema, route).toBeDefined();
    }
  });

  it('documents request bodies from the validation schemas', () => {
    for (const { route, op } of operations(doc)) {
      if (!/^(PUT|POST)/.test(route) || route.endsWith('/admin/reset'))
        continue;
      const body = op.requestBody as
        { content: Record<string, { schema?: unknown }> } | undefined;
      expect(body?.content['application/json']?.schema, route).toBeDefined();
    }
  });
});
