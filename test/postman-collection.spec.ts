import { RequestMethod, type Type } from '@nestjs/common';
import {
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants.js';
import { readFileSync } from 'node:fs';

/**
 * Guards the process "every endpoint is in the Postman collection".
 * Reads routes straight from Nest decorator metadata (no app boot, no DB),
 * and compares them with the requests in postman/.
 */

const COLLECTION_PATH = new URL(
  '../postman/store-front-sync.postman_collection.json',
  import.meta.url,
);

// Module files validate env at import time (ConfigModule.forRoot), so give them
// a placeholder before importing. Nothing connects to it: the app is never booted.
process.env.DATABASE_URL ??= 'postgres://unused:unused@localhost:5432/unused';
const { ApiModule } = await import('../src/api/api.module.js');
const { PlatformMockModule } =
  await import('../src/platform-mock/platform-mock.module.js');

/** Which Postman base-url variable each Nest app is served from. */
const APPS: Record<string, Type> = {
  apiBaseUrl: ApiModule,
  mockBaseUrl: PlatformMockModule,
};

const join = (...parts: (string | undefined)[]) =>
  '/' +
  parts
    .flatMap((p) => (p ?? '').split('/'))
    .filter(Boolean)
    .join('/');

function controllersOf(module: Type, seen = new Set<Type>()): Type[] {
  if (seen.has(module)) return [];
  seen.add(module);
  const own: Type[] =
    Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ?? [];
  const imports: unknown[] =
    Reflect.getMetadata(MODULE_METADATA.IMPORTS, module) ?? [];
  return [
    ...own,
    ...imports
      .filter((m): m is Type => typeof m === 'function')
      .flatMap((m) => controllersOf(m, seen)),
  ];
}

function nestRoutes(): string[] {
  const routes: string[] = [];
  for (const [base, module] of Object.entries(APPS)) {
    for (const controller of controllersOf(module)) {
      const prefix: string = Reflect.getMetadata(PATH_METADATA, controller);
      const proto = controller.prototype as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(proto)) {
        const handler = proto[key];
        if (key === 'constructor' || typeof handler !== 'function') continue;
        const method: RequestMethod | undefined = Reflect.getMetadata(
          METHOD_METADATA,
          handler,
        );
        const path: string | undefined = Reflect.getMetadata(
          PATH_METADATA,
          handler,
        );
        if (method === undefined || path === undefined) continue;
        routes.push(`${base} ${RequestMethod[method]} ${join(prefix, path)}`);
      }
    }
  }
  return routes.sort();
}

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: { method: string; url: { host: string[]; path: string[] } };
}

function postmanRoutes(): Set<string> {
  const collection = JSON.parse(readFileSync(COLLECTION_PATH, 'utf8')) as {
    item: PostmanItem[];
  };
  const routes = new Set<string>();
  const walk = (items: PostmanItem[]) => {
    for (const item of items) {
      if (item.item) walk(item.item);
      if (!item.request) continue;
      const base = item.request.url.host[0].replace(/^\{\{|\}\}$/g, '');
      routes.add(
        `${base} ${item.request.method} ${join(...item.request.url.path)}`,
      );
    }
  };
  walk(collection.item);
  return routes;
}

describe('Postman collection', () => {
  it('covers every HTTP endpoint', () => {
    const covered = postmanRoutes();
    const missing = nestRoutes().filter((route) => !covered.has(route));
    expect(
      missing,
      'Add these endpoints to postman/store-front-sync.postman_collection.json',
    ).toEqual([]);
  });
});
