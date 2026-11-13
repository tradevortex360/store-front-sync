import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { nestErrorSchema } from '../../common/http-error.schema.js';
import { AvailabilityCheck } from '../../database/entities/availability-check.entity.js';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  mismatchesQuerySchema,
  mismatchPageSchema,
  type MismatchesQuery,
  type MismatchPage,
} from './mismatches.schemas.js';

@ApiTags('Mismatches')
@Controller('mismatches')
export class MismatchesController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  @ApiOperation({
    summary: 'List stored mismatches',
    description:
      'Reads the comparisons the worker stored in `availability_checks` and returns only the mismatches (`result` other than `match`), newest first. ' +
      'Every filter is optional and they combine with AND. `from` is inclusive and `to` exclusive, both on `comparedAt`. ' +
      'Failed status checks are never stored, so they never show up here.',
  })
  @ApiQuery({
    name: 'listingId',
    required: false,
    description: 'Only this listing.',
    example: 'lst_ber_001',
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    enum: ['open_outside_hours', 'closed_during_hours', 'paused_during_hours'],
    description: 'Only this kind of mismatch.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'ISO 8601 time with offset; `comparedAt >= from`.',
    example: '2026-11-13T00:00:00Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'ISO 8601 time with offset; `comparedAt < to`.',
    example: '2026-11-14T00:00:00Z',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_LIMIT,
      default: DEFAULT_LIMIT,
    },
    description: 'Page size.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    schema: { type: 'integer', minimum: 0, default: 0 },
    description: 'Rows to skip, for paging.',
  })
  @ApiOkResponse({
    description: 'One page of mismatches and the total count.',
    standardSchema: mismatchPageSchema,
  })
  @ApiBadRequestResponse({
    description:
      'A query parameter is invalid: unknown name, unknown `kind`, a time that is not ISO 8601 with offset, `limit` outside 1–500, negative `offset`, or `from` later than `to`.',
    standardSchema: nestErrorSchema,
  })
  async list(
    @Query({ schema: mismatchesQuerySchema }) query: MismatchesQuery,
  ): Promise<MismatchPage> {
    const qb = this.dataSource
      .getRepository(AvailabilityCheck)
      .createQueryBuilder('c')
      .where(`c.result <> 'match'`);
    if (query.listingId)
      qb.andWhere('c.listingId = :listingId', { listingId: query.listingId });
    if (query.kind) qb.andWhere('c.result = :kind', { kind: query.kind });
    if (query.from)
      qb.andWhere('c.comparedAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('c.comparedAt < :to', { to: new Date(query.to) });

    const [rows, total] = await qb
      .orderBy('c.comparedAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .offset(query.offset)
      .limit(query.limit)
      .getManyAndCount();

    return {
      total,
      limit: query.limit,
      offset: query.offset,
      items: rows.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        checkedAt: r.checkedAt.toISOString(),
        comparedAt: r.comparedAt.toISOString(),
        expectedOpen: r.expectedOpen,
        actualStatus: r.actualStatus,
        // The query only returns mismatches.
        kind: r.result as Exclude<typeof r.result, 'match'>,
      })),
    };
  }
}
