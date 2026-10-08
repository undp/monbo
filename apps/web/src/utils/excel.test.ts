import { describe, expect, it } from "vitest";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { validateData } from "./excel";

// The upload's mandatory attributes (excel.ts keeps them private).
const MANDATORY = [
  "producerName",
  "productionDate",
  "productionQuantity",
  "productionQuantityUnit",
  "coordinatesFormat",
  "geometryType",
  "farmCoordinates",
  "cropType",
];

const POLYGON = "[[[-84.37,10.14],[-84.36,10.14],[-84.36,10.15],[-84.37,10.14]]]";

type Row = Record<string, string | number | null>;

const validRow = (overrides: Row = {}): Row => ({
  producerName: "Ana Pérez",
  productionDate: "2024-11-25T00:00:00.000Z",
  productionQuantity: 48.5,
  productionQuantityUnit: "kg",
  coordinatesFormat: "GeoJSON",
  geometryType: "Polygon",
  farmCoordinates: POLYGON,
  cropType: "Café",
  ...overrides,
});

const validate = async (data: Row[], language: TestLocale = "es") => {
  const { t } = await createTestI18n(language);
  return validateData({ data, mandatoryHeaders: MANDATORY, t, language });
};

describe("validateData", () => {
  it("accepts complete rows in every supported format", async () => {
    expect(
      await validate([
        validRow(),
        validRow({ geometryType: "Point", farmCoordinates: "[-84.3, 10.1]" }),
        validRow({ coordinatesFormat: "WKT", farmCoordinates: "POLYGON ((-84.37 10.14, -84.36 10.14, -84.36 10.15, -84.37 10.14))" }),
        validRow({ coordinatesFormat: "WKT", geometryType: "Point", farmCoordinates: "point(-84.3 10.1)" }),
      ])
    ).toEqual([]);
  });

  it("names the missing header and the template row, in each language", async () => {
    expect(await validate([validRow({ producerName: null })], "es")).toEqual([
      "Falta dato obligatorio (nombre productor) en la fila 4",
    ]);
    expect(await validate([validRow(), validRow({ cropType: "" })], "en")).toEqual([
      "Missing mandatory data (crop type) in row 5",
    ]);
  });

  it("rejects an unknown coordinates format", async () => {
    expect(await validate([validRow({ coordinatesFormat: "KML" })])).toContain(
      "Formato de coordenadas inválido en la fila 4"
    );
  });

  it("rejects an unknown geometry type", async () => {
    expect(await validate([validRow({ geometryType: "MultiPolygon" })], "en")).toContain(
      "Invalid geometry type in row 4"
    );
  });

  it.each([
    ["WKT that isn't a point or polygon", { coordinatesFormat: "WKT", farmCoordinates: "LINESTRING (-84.3 10.1, -84.2 10.2)" }],
    ["a GeoJSON point out of range", { geometryType: "Point", farmCoordinates: "[-200, 10]" }],
    ["a GeoJSON point that isn't a pair", { geometryType: "Point", farmCoordinates: "[-84.3]" }],
    ["a GeoJSON polygon ring with fewer than 4 points", { farmCoordinates: "[[[-84.37,10.14],[-84.36,10.14],[-84.37,10.14]]]" }],
    ["a GeoJSON polygon without rings", { farmCoordinates: "[]" }],
    ["coordinates that aren't JSON", { farmCoordinates: "not json" }],
  ])("rejects %s", async (_, overrides) => {
    expect(await validate([validRow(overrides)])).toEqual([
      "Coordenadas inválidas en la fila 4",
    ]);
  });
});
