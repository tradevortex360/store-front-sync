import {
  WEEKDAYS,
  type ListingStatus,
  type OpeningHours,
  type Weekday,
} from '../../common/listing.types.js';
import type { MismatchKind } from '../../database/entities/mismatch.entity.js';

/** Day of week and minute of day as shown on a wall clock in `timezone`. */
export interface LocalTime {
  weekday: Weekday;
  /** 0–1439 */
  minuteOfDay: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    // Throws RangeError for an unknown IANA timezone.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timezone, formatter);
  }
  return formatter;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    formatterFor(timezone);
    return true;
  } catch {
    return false;
  }
}

/** Converts an instant to the local weekday and time in `timezone`. DST is handled by Intl. */
export function localTimeAt(instant: Date, timezone: string): LocalTime {
  const parts = formatterFor(timezone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday').toLowerCase().slice(0, 3) as Weekday;
  return {
    weekday,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** "HH:mm" → minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function previousDay(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + 6) % 7];
}

/**
 * Whether the opening hours say the listing should be open at `instant`.
 *
 * Slots are `[open, close)`. A slot whose `close` is earlier than `open` runs past midnight:
 * its first part belongs to the day it is listed under, and its tail (`00:00`–`close`)
 * belongs to the next day, so we also look at yesterday's overnight slots. A slot where
 * `open == close` means open for 24 hours.
 */
export function isWithinOpeningHours(
  hours: OpeningHours,
  timezone: string,
  instant: Date,
): boolean {
  const { weekday, minuteOfDay: now } = localTimeAt(instant, timezone);

  const today = hours[weekday].some((slot) => {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    if (close > open) return now >= open && now < close;
    return now >= open; // overnight or 24 h slot: from `open` until midnight
  });
  if (today) return true;

  return hours[previousDay(weekday)].some((slot) => {
    const open = toMinutes(slot.open);
    const close = toMinutes(slot.close);
    if (close > open) return false;
    // The tail of yesterday's overnight slot (a 24 h slot ends at `close` == `open`).
    return now < close;
  });
}

/**
 * Compares what the platform shows with what the opening hours say.
 * `PAUSED` or `CLOSED` outside hours is fine: customers can't order either way.
 */
export function detectMismatch(
  expectedOpen: boolean,
  status: ListingStatus,
): MismatchKind | null {
  if (expectedOpen) {
    if (status === 'CLOSED') return 'closed_during_hours';
    if (status === 'PAUSED') return 'paused_during_hours';
    return null;
  }
  return status === 'OPEN' ? 'open_outside_hours' : null;
}
