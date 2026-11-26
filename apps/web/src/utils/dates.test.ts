import { describe, expect, it } from "vitest";
import { inTimeZone, TIME_ZONES } from "@/test/timeZone";
import {
  calendarDay,
  longFormatDateByLanguage,
  shortFormatDateByLanguage,
} from "./dates";

// Local times (no "Z"), so the date doesn't depend on the machine's timezone.
const DATE = "2024-11-25T12:00:00";

describe("shortFormatDateByLanguage", () => {
  it("puts the year first in English and last in Spanish", () => {
    expect(shortFormatDateByLanguage(DATE, "en")).toBe("2024-11-25");
    expect(shortFormatDateByLanguage(DATE, "es")).toBe("25-11-2024");
  });

  it("shows a date it can't read as written", () => {
    expect(shortFormatDateByLanguage("15/01/2025", "es")).toBe("15/01/2025");
  });
});

describe("longFormatDateByLanguage", () => {
  it("writes the month in each language", () => {
    expect(longFormatDateByLanguage(DATE, "es")).toBe("25 de noviembre de 2024");
    expect(longFormatDateByLanguage(DATE, "en")).toBe("November 25th, 2024");
  });

  it("accepts a Date and defaults to Spanish", () => {
    expect(longFormatDateByLanguage(new Date(2025, 0, 1))).toBe(
      "01 de enero de 2025"
    );
  });
});

describe.each(TIME_ZONES)("a production date in %s", (zone) => {
  inTimeZone(zone);

  it("is the uploaded day when it comes as text", () => {
    expect(shortFormatDateByLanguage("2025-01-15", "es")).toBe("15-01-2025");
    expect(shortFormatDateByLanguage("2025-01-15", "en")).toBe("2025-01-15");
    expect(longFormatDateByLanguage("2025-01-15", "es")).toBe(
      "15 de enero de 2025"
    );
  });

  it("is the same day from an Excel date cell or the manual form", () => {
    // Both write the ISO string of local midnight.
    const written = new Date(2025, 0, 15).toISOString();
    expect(shortFormatDateByLanguage(written, "es")).toBe("15-01-2025");
  });

  it("is the same day from a local timestamp", () => {
    expect(shortFormatDateByLanguage("2025-01-15T00:00:00", "es")).toBe(
      "15-01-2025"
    );
  });
});

describe.each(TIME_ZONES)("calendarDay in %s", (zone) => {
  inTimeZone(zone);

  it("is the day the app shows, whatever the format it came in", () => {
    expect(calendarDay(new Date(2025, 0, 15).toISOString())).toBe("2025-01-15");
    expect(calendarDay("2025-01-15")).toBe("2025-01-15");
    expect(calendarDay("2025-01-15T00:00:00")).toBe("2025-01-15");
  });

  it("is a date it can't read as written", () => {
    expect(calendarDay("15/01/2025")).toBe("15/01/2025");
  });
});
