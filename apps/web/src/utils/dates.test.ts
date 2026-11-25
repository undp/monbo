import { describe, expect, it } from "vitest";
import { longFormatDateByLanguage, shortFormatDateByLanguage } from "./dates";

// Local times (no "Z"), so the date doesn't depend on the machine's timezone.
const DATE = "2024-11-25T12:00:00";

describe("shortFormatDateByLanguage", () => {
  it("puts the year first in English and last in Spanish", () => {
    expect(shortFormatDateByLanguage(DATE, "en")).toBe("2024-11-25");
    expect(shortFormatDateByLanguage(DATE, "es")).toBe("25-11-2024");
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
