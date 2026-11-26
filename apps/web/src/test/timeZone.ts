import { afterEach, beforeEach } from "vitest";

/** The zones that tell a date shifted to UTC apart: west of UTC, UTC and east of it. */
export const TIME_ZONES = ["America/Bogota", "UTC", "Asia/Tokyo"];

/**
 * Runs the suite's tests with the browser's time zone set to `zone`, and restores
 * the machine's zone after each one. Node applies a new `TZ` at once; each test
 * file runs in its own process (Vitest's `forks` pool), so it can't leak to others.
 * Build any `Date` from local fields inside the test, after the zone is set.
 */
export const inTimeZone = (zone: string) => {
  let previous: string | undefined;
  beforeEach(() => {
    previous = process.env.TZ;
    process.env.TZ = zone;
  });
  afterEach(() => {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  });
};
