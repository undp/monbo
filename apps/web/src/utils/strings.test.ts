import { describe, expect, it } from "vitest";
import { getCommaSeparatedUniqueTexts, removeDiacritics } from "./strings";

describe("removeDiacritics", () => {
  it("removes accents and keeps the letters", () => {
    expect(removeDiacritics("Café Arábica, piñata, Perú")).toBe(
      "Cafe Arabica, pinata, Peru"
    );
  });
});

describe("getCommaSeparatedUniqueTexts", () => {
  it("drops empty values and duplicates, and sorts", () => {
    expect(
      getCommaSeparatedUniqueTexts(["banana", undefined, "apple", null, "banana", ""])
    ).toBe("apple, banana");
  });

  it("returns an empty string for no texts", () => {
    expect(getCommaSeparatedUniqueTexts([null, undefined])).toBe("");
  });
});
