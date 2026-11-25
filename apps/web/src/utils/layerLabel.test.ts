import { describe, expect, it } from "vitest";
import { layerLabel } from "./layerLabel";

describe("layerLabel", () => {
  it("shows the name with the alias", () => {
    expect(layerLabel({ id: 1, name: "Global Forest Watch", alias: "GFW" })).toBe(
      "Global Forest Watch (GFW)"
    );
  });

  it("doesn't repeat an alias equal to the name", () => {
    expect(layerLabel({ id: 1, name: "TMF", alias: "TMF" })).toBe("TMF");
  });

  it("falls back to the alias, then to the id", () => {
    expect(layerLabel({ id: 1, name: null, alias: "GFW" })).toBe("GFW");
    expect(layerLabel({ id: 7, name: "  ", alias: null })).toBe("7");
  });

  it("prefers the alias in the short style", () => {
    expect(
      layerLabel({ id: 1, name: "Global Forest Watch", alias: " GFW " }, "short")
    ).toBe("GFW");
    expect(layerLabel({ id: 1, name: "Global Forest Watch", alias: "" }, "short")).toBe(
      "Global Forest Watch"
    );
    expect(layerLabel({ id: 3, name: null, alias: null }, "short")).toBe("3");
  });
});
