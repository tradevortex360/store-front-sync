import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1794441600000 implements MigrationInterface {
  name = 'InitialSchema1794441600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE listings (
        id            text PRIMARY KEY,
        name          text NOT NULL,
        timezone      text NOT NULL,
        listing_url   text NOT NULL,
        opening_hours jsonb NOT NULL,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE status_checks (
        id          bigserial PRIMARY KEY,
        listing_id  text NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
        checked_at  timestamptz NOT NULL,
        outcome     varchar(32) NOT NULL
                    CHECK (outcome IN ('ok', 'timeout', 'http_error', 'network_error', 'invalid_payload')),
        status      varchar(16)
                    CHECK (status IN ('OPEN', 'CLOSED', 'PAUSED')),
        http_status int,
        latency_ms  int NOT NULL,
        error       text,
        CONSTRAINT status_present_iff_ok CHECK ((outcome = 'ok') = (status IS NOT NULL))
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_status_checks_listing_checked_at ON status_checks (listing_id, checked_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE status_checks`);
    await queryRunner.query(`DROP TABLE listings`);
  }
}
