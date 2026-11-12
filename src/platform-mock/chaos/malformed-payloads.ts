import type { PlatformListing } from '../../common/listing.types.js';

/**
 * Raw response bodies that look plausible but break the contract. Each is
 * sent with status 200 and `Content-Type: application/json`, the way a
 * misbehaving upstream would.
 */

const json = (value: unknown) => JSON.stringify(value);

export function malformedStatusBodies(): string[] {
  return [
    json({ status: 'open' }), // wrong casing
    json({ status: 'BUSY' }), // unknown enum value
    json({ state: 'OPEN' }), // wrong field name
    json({ status: 1 }), // wrong type
    json({}), // missing field
    '{"status":"OP', // truncated JSON
    '<html><body>502 Bad Gateway</body></html>', // HTML from a proxy
    '', // empty body
  ];
}

export function malformedListingsBodies(listings: PlatformListing[]): string[] {
  const [first, ...rest] = listings;
  return [
    json({ listings }), // wrapped instead of a bare array
    json([{ ...first, timezone: 'Mars/Olympus_Mons' }, ...rest]), // invalid IANA timezone
    json([
      {
        ...first,
        openingHours: {
          ...first.openingHours,
          mon: [{ open: '25:99', close: '9pm' }],
        },
      },
      ...rest,
    ]), // invalid times
    json([{ ...first, openingHours: 'Mon-Fri 9-17' }, ...rest]), // free-text hours
    json(listings.map(({ id: _id, ...noId }) => noId)), // missing ids
    json(listings).slice(0, 120), // truncated JSON
    'null',
  ];
}

export function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length) % items.length];
}
