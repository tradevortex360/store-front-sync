import {
  StandardSchemaValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { WEEKDAYS } from '../src/common/listing.types.js';
import { PlatformMockModule } from '../src/platform-mock/platform-mock.module.js';

describe('platform-mock (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformMockModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new StandardSchemaValidationPipe());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /listings returns 5 listings matching the contract', async () => {
    const res = await request(app.getHttpServer()).get('/listings').expect(200);
    expect(res.body).toHaveLength(5);
    for (const listing of res.body) {
      expect(listing).toEqual({
        id: expect.any(String),
        name: expect.any(String),
        timezone: expect.stringMatching(/^[A-Za-z]+\/[A-Za-z_]+$/),
        listingUrl: expect.stringMatching(/^https?:\/\//),
        openingHours: expect.any(Object),
      });
      expect(Object.keys(listing.openingHours)).toEqual([...WEEKDAYS]);
      for (const day of WEEKDAYS) {
        for (const slot of listing.openingHours[day]) {
          expect(slot.open).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
          expect(slot.close).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
        }
      }
    }
  });

  it('GET /listings/:id/status returns the status, 404 for unknown ids', async () => {
    await request(app.getHttpServer())
      .get('/listings/lst_lon_005/status')
      .expect(200, { status: 'PAUSED' });
    await request(app.getHttpServer()).get('/listings/nope/status').expect(404);
  });

  it('admin can force a status and reset it', async () => {
    const server = app.getHttpServer();
    await request(server)
      .put('/admin/listings/lst_ber_001/status')
      .send({ status: 'PAUSED' })
      .expect(200);
    await request(server)
      .get('/listings/lst_ber_001/status')
      .expect(200, { status: 'PAUSED' });
    await request(server)
      .put('/admin/listings/lst_ber_001/status')
      .send({ status: 'SLEEPING' })
      .expect(400);
    await request(server).post('/admin/reset').expect(200);
    await request(server)
      .get('/listings/lst_ber_001/status')
      .expect(200, { status: 'OPEN' });
  });

  it('injects errors and malformed bodies on demand', async () => {
    const server = app.getHttpServer();
    await request(server)
      .put('/admin/chaos')
      .send({ errorRate: 1, errorStatus: 502 })
      .expect(200);
    await request(server).get('/listings').expect(502);

    await request(server)
      .put('/admin/chaos')
      .send({ errorRate: 0 })
      .expect(200);
    await request(server)
      .put('/admin/chaos/listings/lst_ber_001')
      .send({ malformedRate: 1 })
      .expect(200);
    const res = await request(server)
      .get('/listings/lst_ber_001/status')
      .buffer(true)
      .parse((r, cb) => {
        let body = '';
        r.on('data', (c: Buffer) => (body += c.toString()));
        r.on('end', () => cb(null, body));
      });
    expect(res.status).toBe(200);
    expect(res.body).not.toMatch(/^\{"status":"(OPEN|CLOSED|PAUSED)"\}$/);

    // other listings are unaffected by the per-listing override
    await request(server)
      .get('/listings/lst_vie_002/status')
      .expect(200, { status: 'OPEN' });
  });

  it('adds latency on demand', async () => {
    const server = app.getHttpServer();
    await request(server)
      .put('/admin/chaos')
      .send({ latencyMs: 300 })
      .expect(200);
    const started = Date.now();
    await request(server).get('/listings/lst_vie_002/status').expect(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(290);
  });

  it('rejects invalid chaos config', async () => {
    await request(app.getHttpServer())
      .put('/admin/chaos')
      .send({ errorRate: 0.7, malformedRate: 0.7 })
      .expect(400);
    await request(app.getHttpServer())
      .put('/admin/chaos')
      .send({ bogus: true })
      .expect(400);
  });
});
