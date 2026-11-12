import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Mismatches1794528000000 implements MigrationInterface {
  name = 'Mismatches1794528000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE mismatches (
        id              bigserial PRIMARY KEY,
        -- Platform listing id. No foreign key: the worker doesn't write the listings table.
        listing_id      text NOT NULL,
        detected_at     timestamptz NOT NULL,
        expected_open   boolean NOT NULL,
        actual_status   varchar(16) NOT NULL
                        CHECK (actual_status IN ('OPEN', 'CLOSED', 'PAUSED')),
        kind            varchar(32) NOT NULL
                        CHECK (kind IN ('open_outside_hours', 'closed_during_hours', 'paused_during_hours')),
        -- Only real contradictions get stored.
        CONSTRAINT kind_matches_state CHECK (
          (kind = 'open_outside_hours'  AND NOT expected_open AND actual_status = 'OPEN')   OR
          (kind = 'closed_during_hours' AND expected_open     AND actual_status = 'CLOSED') OR
          (kind = 'paused_during_hours' AND expected_open     AND actual_status = 'PAUSED')
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_mismatches_listing_detected_at ON mismatches (listing_id, detected_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE mismatches`);
  }
}
