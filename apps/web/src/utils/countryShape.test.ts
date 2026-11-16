import { describe, expect, it } from "vitest";
import { getCountryShape } from "./countryShape";

describe("getCountryShape", () => {
  it.each(["CO", "EC", "CR", "PE"])("has a silhouette for %s", (code) => {
    expect(getCountryShape(code)).toMatch(/^M/);
  });

  it("has none for an unknown code", () => {
    expect(getCountryShape("XX")).toBeUndefined();
  });
});
