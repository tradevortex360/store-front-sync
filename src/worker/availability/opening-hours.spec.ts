import type { OpeningHours, TimeSlot } from '../../common/listing.types.js';
import {
  compareStatus,
  isValidTimezone,
  isWithinOpeningHours,
  localTimeAt,
} from './opening-hours.js';

const slot = (open: string, close: string): TimeSlot => ({ open, close });
const everyDay = (...slots: TimeSlot[]): OpeningHours => ({
  mon: slots,
  tue: slots,
  wed: slots,
  thu: slots,
  fri: slots,
  sat: slots,
  sun: slots,
});

// Same hours as the platform-mock seed data.
const berlin: OpeningHours = {
  mon: [slot('11:00', '15:00'), slot('17:00', '22:00')],
  tue: [slot('11:00', '15:00'), slot('17:00', '22:00')],
  wed: [slot('11:00', '15:00'), slot('17:00', '22:00')],
  thu: [slot('11:00', '15:00'), slot('17:00', '22:00')],
  fri: [slot('11:00', '15:00'), slot('17:00', '23:00')],
  sat: [slot('12:00', '23:00')],
  sun: [],
};
const helsinki: OpeningHours = {
  ...everyDay(slot('10:30', '21:00')),
  fri: [slot('10:30', '02:00')],
  sat: [slot('12:00', '02:00')],
  sun: [slot('12:00', '20:00')],
};
const amsterdam = everyDay(slot('18:00', '04:00'));

const at = (iso: string) => new Date(iso);

describe('localTimeAt', () => {
  it('converts to the listing timezone, including DST', () => {
    // 2026-11-13 is a Friday. Berlin is UTC+1 in November, UTC+2 in July.
    expect(localTimeAt(at('2026-11-13T11:00:00Z'), 'Europe/Berlin')).toEqual({
      weekday: 'fri',
      minuteOfDay: 12 * 60,
    });
    expect(localTimeAt(at('2026-07-15T09:30:00Z'), 'Europe/Berlin')).toEqual({
      weekday: 'wed',
      minuteOfDay: 11 * 60 + 30,
    });
  });

  it('can land on a different weekday than UTC', () => {
    // Friday 23:30 UTC is already Saturday 01:30 in Helsinki.
    expect(localTimeAt(at('2026-11-13T23:30:00Z'), 'Europe/Helsinki')).toEqual({
      weekday: 'sat',
      minuteOfDay: 90,
    });
  });
});

describe('isWithinOpeningHours', () => {
  it.each([
    ['Fri 12:00, lunch shift', '2026-11-13T11:00:00Z', true],
    ['Fri 16:00, gap between shifts', '2026-11-13T15:00:00Z', false],
    ['Fri 15:00, close is exclusive', '2026-11-13T14:00:00Z', false],
    ['Fri 11:00, open is inclusive', '2026-11-13T10:00:00Z', true],
    ['Fri 22:30, longer Friday dinner', '2026-11-13T21:30:00Z', true],
    ['Sun 13:00, closed all day', '2026-11-15T12:00:00Z', false],
    ['Wed 11:30 in summer (CEST)', '2026-07-15T09:30:00Z', true],
    ['Wed 10:30 in winter (CET), same UTC time', '2026-11-11T09:30:00Z', false],
  ])('Berlin %s', (_, iso, expected) => {
    expect(isWithinOpeningHours(berlin, 'Europe/Berlin', at(iso))).toBe(
      expected,
    );
  });

  it.each([
    ['Fri 23:00, before midnight', '2026-11-13T21:00:00Z', true],
    ['Sat 01:30, tail of Friday past midnight', '2026-11-13T23:30:00Z', true],
    ['Sat 02:00, tail ended', '2026-11-14T00:00:00Z', false],
    [
      'Mon 01:00, Sunday slot does not run past midnight',
      '2026-11-15T23:00:00Z',
      false,
    ],
    [
      'Fri 01:00, Thursday slot does not run past midnight',
      '2026-11-12T23:00:00Z',
      false,
    ],
  ])('Helsinki %s', (_, iso, expected) => {
    expect(isWithinOpeningHours(helsinki, 'Europe/Helsinki', at(iso))).toBe(
      expected,
    );
  });

  it.each([
    ['03:59', '2026-11-13T02:59:00Z', true],
    ['04:00', '2026-11-13T03:00:00Z', false],
    ['17:59', '2026-11-13T16:59:00Z', false],
    ['18:00', '2026-11-13T17:00:00Z', true],
    ['00:00', '2026-11-12T23:00:00Z', true],
  ])('Amsterdam 18:00–04:00 every day at %s', (_, iso, expected) => {
    expect(isWithinOpeningHours(amsterdam, 'Europe/Amsterdam', at(iso))).toBe(
      expected,
    );
  });

  it('treats open == close as open for 24 hours', () => {
    const hours: OpeningHours = {
      ...everyDay(),
      mon: [slot('06:00', '06:00')],
    };
    // 2026-11-16 is a Monday; London is UTC+0 in November.
    expect(
      isWithinOpeningHours(hours, 'Europe/London', at('2026-11-16T05:59:00Z')),
    ).toBe(false);
    expect(
      isWithinOpeningHours(hours, 'Europe/London', at('2026-11-16T06:00:00Z')),
    ).toBe(true);
    expect(
      isWithinOpeningHours(hours, 'Europe/London', at('2026-11-17T05:59:00Z')),
    ).toBe(true);
    expect(
      isWithinOpeningHours(hours, 'Europe/London', at('2026-11-17T06:00:00Z')),
    ).toBe(false);
  });
});

describe('isValidTimezone', () => {
  it('accepts IANA zones and rejects garbage', () => {
    expect(isValidTimezone('Europe/Berlin')).toBe(true);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
  });
});

describe('compareStatus', () => {
  it.each([
    [true, 'OPEN', 'match'],
    [true, 'CLOSED', 'closed_during_hours'],
    [true, 'PAUSED', 'paused_during_hours'],
    [false, 'OPEN', 'open_outside_hours'],
    [false, 'CLOSED', 'match'],
    [false, 'PAUSED', 'match'],
  ] as const)(
    'expectedOpen=%s, status=%s → %s',
    (expectedOpen, status, kind) => {
      expect(compareStatus(expectedOpen, status)).toBe(kind);
    },
  );
});
