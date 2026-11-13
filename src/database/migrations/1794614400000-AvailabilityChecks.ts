import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces `mismatches` with `availability_checks`, which stores every comparison
 * (matches too) together with the time it was made. Mismatches are the rows whose
 * `result` is not `match`.
 */
export class AvailabilityChecks1794614400000 implements MigrationInterface {
  name = 'AvailabilityChecks1794614400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE availability_checks (
        id              bigserial PRIMARY KEY,
        -- Platform listing id. No foreign key: the worker does not write the listings table.
        listing_id      text NOT NULL,
        checked_at      timestamptz NOT NULL,
        compared_at     timestamptz NOT NULL,
        expected_open   boolean NOT NULL,
        actual_status   varchar(16) NOT NULL
                        CHECK (actual_status IN ('OPEN', 'CLOSED', 'PAUSED')),
        result          varchar(32) NOT NULL
                        CHECK (result IN ('match', 'open_outside_hours', 'closed_during_hours', 'paused_during_hours')),
        CONSTRAINT compared_after_checked CHECK (compared_at >= checked_at),
        -- The result must follow from expected_open and actual_status.
        CONSTRAINT result_matches_state CHECK (
          (result = 'open_outside_hours'  AND NOT expected_open AND actual_status = 'OPEN')   OR
          (result = 'closed_during_hours' AND expected_open     AND actual_status = 'CLOSED') OR
          (result = 'paused_during_hours' AND expected_open     AND actual_status = 'PAUSED') OR
          (result = 'match' AND (
             (expected_open AND actual_status = 'OPEN') OR
             (NOT expected_open AND actual_status IN ('CLOSED', 'PAUSED'))
          ))
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_availability_checks_listing_compared_at ON availability_checks (listing_id, compared_at)`,
    );
    // Serves the api's mismatch queries, which never look at matches.
    await queryRunner.query(
      `CREATE INDEX idx_availability_checks_mismatches ON availability_checks (compared_at) WHERE result <> 'match'`,
    );

    await queryRunner.query(`DROP TABLE mismatches`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE mismatches (
        id              bigserial PRIMARY KEY,
        listing_id      text NOT NULL,
        detected_at     timestamptz NOT NULL,
        expected_open   boolean NOT NULL,
        actual_status   varchar(16) NOT NULL
                        CHECK (actual_status IN ('OPEN', 'CLOSED', 'PAUSED')),
        kind            varchar(32) NOT NULL
                        CHECK (kind IN ('open_outside_hours', 'closed_during_hours', 'paused_during_hours')),
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
    // Keep the mismatches when rolling back.
    await queryRunner.query(`
      INSERT INTO mismatches (listing_id, detected_at, expected_open, actual_status, kind)
      SELECT listing_id, compared_at, expected_open, actual_status, result
      FROM availability_checks WHERE result <> 'match'
    `);
    await queryRunner.query(`DROP TABLE availability_checks`);
  }
}
