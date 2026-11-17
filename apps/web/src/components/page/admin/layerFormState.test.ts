import { describe, expect, it } from "vitest";
import type { AdminLayer } from "@/interfaces/AdminLayer";
import { toFormValues, toLayerInput } from "./layerFormState";

const layer = (overrides: Partial<AdminLayer> = {}): AdminLayer => ({
  id: 7,
  category_id: "protected_areas",
  category_issue: null,
  category_enabled: true,
  pixel_size: 30,
  baseline: 2020,
  compared_against: 2024,
  references: [],
  enabled: false,
  version: 1,
  raster_filename: "layer-7-v1.tif",
  has_raster: true,
  attributes: {
    en: { name: "Parks", alias: "PARKS", coverage: null, source: null, resolution: null, contentDate: null, updateFrequency: null, publishDate: null },
    es: { name: "Parques", alias: "PARQUES", coverage: null, source: null, resolution: null, contentDate: null, updateFrequency: null, publishDate: null },
  },
  considerations: { en: null, es: null },
  ...overrides,
});

describe("layer form category", () => {
  it("sends a new layer in the deforestation category", () => {
    expect(toLayerInput(toFormValues()).category_id).toBe("deforestation");
  });

  it("keeps an existing layer's category when saving", () => {
    expect(toLayerInput(toFormValues(layer())).category_id).toBe("protected_areas");
  });
});
