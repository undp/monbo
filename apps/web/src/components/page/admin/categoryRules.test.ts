import { describe, expect, it } from "vitest";
import { makeAdminCategory, makeAdminLayer } from "@/test/factories";
import { categoryLocks } from "./categoryRules";

const alias = (id: number, name: string, enabled: boolean, categoryId = "deforestation") =>
  makeAdminLayer({
    id,
    enabled,
    category_id: categoryId,
    attributes: {
      en: { name, alias: name, coverage: null, source: null, resolution: null, contentDate: null, updateFrequency: null, publishDate: null },
      es: { name, alias: name, coverage: null, source: null, resolution: null, contentDate: null, updateFrequency: null, publishDate: null },
    },
  });

describe("categoryLocks", () => {
  const layers = [
    alias(0, "IDEAM", true),
    alias(1, "GFW", false),
    alias(2, "RUNAP", true, "protected_areas"),
  ];

  it("locks the switch and the polarity with the published layers' names", () => {
    const locks = categoryLocks(
      makeAdminCategory({ layerCount: 2, publishedLayerCount: 1 }),
      layers,
      true,
      "es"
    );
    expect(locks.enabled).toEqual({ reason: "publishedLayers", count: 1, layers: ["IDEAM"] });
    expect(locks.polarity).toEqual(locks.enabled);
    expect(locks.temporal).toEqual({ reason: "anyLayers", count: 2, layers: ["IDEAM", "GFW"] });
  });

  it("locks only temporal when every layer is hidden", () => {
    const locks = categoryLocks(
      makeAdminCategory({ layerCount: 1, publishedLayerCount: 0 }),
      [alias(1, "GFW", false)],
      true,
      "es"
    );
    expect(locks.enabled).toBeNull();
    expect(locks.polarity).toBeNull();
    expect(locks.temporal?.reason).toBe("anyLayers");
  });

  it("uses the API's counts even without the layers' names", () => {
    const locks = categoryLocks(
      makeAdminCategory({ layerCount: 3, publishedLayerCount: 2 }),
      [],
      true,
      "es"
    );
    expect(locks.enabled).toEqual({ reason: "publishedLayers", count: 2, layers: [] });
  });

  it("locks nothing for a new or empty category", () => {
    expect(categoryLocks(null, layers, true, "es")).toEqual({
      enabled: null,
      polarity: null,
      temporal: null,
    });
    expect(categoryLocks(makeAdminCategory(), [], true, "es").temporal).toBeNull();
  });

  it("locks everything when the categories file can't be read", () => {
    const locks = categoryLocks(null, layers, false, "es");
    expect(locks.enabled?.reason).toBe("unreadable");
    expect(locks.polarity?.reason).toBe("unreadable");
    expect(locks.temporal?.reason).toBe("unreadable");
  });
});
