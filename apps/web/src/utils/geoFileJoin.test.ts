import { describe, expect, it } from "vitest";
import type { ImportedFeature } from "@/interfaces/Farm";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { geoFeatureId, normalizeFarmId } from "./geoFile";
import { joinRowsWithGeoFeatures } from "./geoFileJoin";

const POLYGON = "POLYGON ((-84.023 9.8783, -84.0201 9.879, -84.0195 9.8761, -84.023 9.8783))";
const POINT = "POINT (-84.01 9.87)";

const feature = (
  position: number,
  properties: ImportedFeature["properties"],
  geometry: Partial<ImportedFeature> = {}
): ImportedFeature => ({
  position,
  properties,
  geometryType: "Polygon",
  farmCoordinates: POLYGON,
  errors: [],
  ...geometry,
});

const row = (id: unknown, overrides: Record<string, unknown> = {}) => ({
  id,
  producerName: "Ana Pérez",
  productionDate: "2025-03-15T00:00:00.000Z",
  productionQuantity: 1200,
  productionQuantityUnit: "kg",
  cropType: "Café",
  area: null,
  documents: [],
  ...overrides,
});

const join = async (
  rows: Record<string, unknown>[],
  features: ImportedFeature[],
  language: TestLocale = "es",
  selectedCountry = "CR"
) => {
  const { t } = await createTestI18n(language);
  const result = joinRowsWithGeoFeatures({
    rows: rows as never,
    geoFile: { format: "kml", features },
    t,
    language,
    selectedCountry,
  });
  return { data: result.rows, errorMessages: result.errorMessages };
};

describe("normalizeFarmId", () => {
  it("compares IDs as trimmed text", () => {
    expect(normalizeFarmId(1)).toBe("1");
    expect(normalizeFarmId(" F-001 ")).toBe("F-001");
    expect(normalizeFarmId("")).toBeNull();
    expect(normalizeFarmId("   ")).toBeNull();
    expect(normalizeFarmId(null)).toBeNull();
    expect(normalizeFarmId(true)).toBeNull();
  });
});

describe("geoFeatureId", () => {
  it.each([
    [{ id: "F-1" }, "F-1"],
    [{ ID: 7 }, "7"],
    [{ Id: " F-2 " }, "F-2"],
    [{ iD: "F-3", other: "x" }, "F-3"],
  ])("reads the id attribute in any case: %o", (properties, expected) => {
    expect(geoFeatureId(properties, true)).toBe(expected);
  });

  it("prefers the exact `id` when there are several spellings", () => {
    expect(geoFeatureId({ ID: "upper", id: "exact" }, true)).toBe("exact");
  });

  it("falls back to the KML name when there is no id", () => {
    expect(geoFeatureId({ Name: "F-001", description: null }, true)).toBe("F-001");
    expect(geoFeatureId({ id: null, Name: "F-002" }, true)).toBe("F-002");
    expect(geoFeatureId({ id: "  ", Name: "F-003" }, true)).toBe("F-003");
  });

  it("has no ID without an id or a name", () => {
    expect(geoFeatureId({ producer: "Ana" }, true)).toBeNull();
    expect(geoFeatureId({ id: null, Name: null }, true)).toBeNull();
  });
});

describe("joinRowsWithGeoFeatures", () => {
  it("gives each Excel row its feature's geometry as WKT, in the Excel's order", async () => {
    const result = await join(
      [row("F-2", { area: 2.5 }), row("F-1")],
      [
        feature(1, { id: "F-1" }),
        feature(2, { id: "F-2" }, { geometryType: "Point", farmCoordinates: POINT }),
      ]
    );

    expect(result.errorMessages).toEqual([]);
    expect(result.data).toEqual([
      {
        ...row("F-2", { area: 2.5 }),
        coordinatesFormat: "WKT",
        geometryType: "Point",
        farmCoordinates: POINT,
      },
      {
        ...row("F-1"),
        coordinatesFormat: "WKT",
        geometryType: "Polygon",
        farmCoordinates: POLYGON,
      },
    ]);
  });

  it("matches a numeric ID with the same ID as text", async () => {
    const result = await join([row("1"), row(" 2 ")], [
      feature(1, { ID: 1 }),
      feature(2, { ID: "2" }),
    ]);

    expect(result.errorMessages).toEqual([]);
    expect(result.data.map((joined) => joined.id)).toEqual(["1", "2"]);
  });

  it("joins Google Earth placemarks by their name", async () => {
    const result = await join([row("F-001")], [
      feature(1, { id: null, Name: "F-001", description: null }),
    ]);

    expect(result.errorMessages).toEqual([]);
    expect(result.data).toHaveLength(1);
  });

  it("reports a feature without ID", async () => {
    const result = await join([row("F-1")], [
      feature(1, { id: "F-1" }),
      feature(2, { producer: "Ana" }),
    ]);

    expect(result).toEqual({
      data: [],
      errorMessages: ["El elemento 2 no tiene ID"],
    });
  });

  it("reports an ID repeated in the geo file once", async () => {
    const result = await join([row("F-1")], [
      feature(1, { id: "F-1" }),
      feature(2, { id: "F-1" }),
      feature(3, { id: " F-1" }),
    ], "en");

    expect(result.errorMessages).toEqual([
      "The ID F-1 appears more than once in the geo file",
    ]);
  });

  it("reports an ID repeated in the Excel with its rows", async () => {
    const result = await join(
      [row("F-1"), row("F-2"), row("F-1")],
      [feature(1, { id: "F-1" }), feature(2, { id: "F-2" })]
    );

    expect(result.errorMessages).toEqual([
      "El ID F-1 se repite en el Excel (filas 4, 6)",
    ]);
  });

  it("reports an Excel row without polygon and a polygon without row", async () => {
    const result = await join(
      [row("F-1"), row("F-9")],
      [feature(1, { id: "F-1" }), feature(2, { id: "F-2" })],
      "en"
    );

    expect(result).toEqual({
      data: [],
      errorMessages: [
        "Row 5 of the Excel (ID F-9) has no geometry in the geo file",
        "There is no row in the Excel for feature 2 (ID F-2)",
      ],
    });
  });

  it("reports an Excel row without ID", async () => {
    const result = await join([row(null)], [feature(1, { id: "F-1" })]);

    expect(result.errorMessages).toEqual([
      "Falta dato obligatorio (ID) en la fila 4",
      "El elemento 1 (ID F-1) no tiene fila en el Excel",
    ]);
  });

  it("reports the features the API could not use, in the user's language", async () => {
    const result = await join([row("F-1")], [
      feature(
        1,
        { id: "F-1" },
        {
          geometryType: null,
          farmCoordinates: null,
          errors: [
            {
              code: "unsupported_geometry",
              message: "Feature 1 is a LineString",
              params: { position: 1, geometryType: "LineString" },
            },
          ],
        }
      ),
    ]);

    expect(result.errorMessages).toEqual([
      "Hay un LineString en el elemento 1 (ID F-1): una finca debe ser un polígono o un punto",
    ]);
  });

  it("falls back to the API's message for an unknown error code", async () => {
    const result = await join([row("F-1")], [
      feature(1, { id: "F-1" }, {
        errors: [{ code: "something_new", message: "Something new", params: {} }],
      }),
    ]);

    expect(result.errorMessages).toEqual(["elemento 1 (ID F-1): Something new"]);
  });

  // The country attribute under every name option 2 accepts (geoAttributeMappings)
  it.each(["ProducerCountry", "PAIS", "país", "country"])(
    "rejects features whose %s isn't the selected country",
    async (attribute) => {
      const result = await join(
        [row("F-1"), row("F-2")],
        [
          feature(1, { id: "F-1", [attribute]: "CR" }),
          feature(2, { id: "F-2", [attribute]: "co" }),
        ],
        "en"
      );

      expect(result.data).toEqual([]);
      expect(result.errorMessages).toEqual([
        "This file has farms in Colombia. Monbo analyzes one country at a time: upload only the farms in Costa Rica, or choose another country.",
      ]);
    }
  );
});
