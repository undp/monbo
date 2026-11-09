import { describe, expect, it } from "vitest";
import type { ImportedFeature } from "@/interfaces/Farm";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { makeFarm, makePolygonFarm } from "@/test/factories";
import { generateGeoJsonFeature } from "./geojson";
import {
  geoFeatureId,
  geoFeaturesToFarmRows,
  isGeoFile,
  UPLOAD_FILE_ACCEPT,
} from "./geoFile";

const POLYGON_WKT = "POLYGON ((-84.023 9.8783, -84.0201 9.879, -84.023 9.8783))";

const feature = (
  properties: ImportedFeature["properties"],
  overrides: Partial<ImportedFeature> = {}
): ImportedFeature => ({
  position: 1,
  properties,
  geometryType: "Polygon",
  farmCoordinates: POLYGON_WKT,
  errors: [],
  ...overrides,
});

const COMPLETE = {
  producerName: "María Muñoz",
  productionDate: "2025-03-15",
  productionQuantity: 1200,
  productionQuantityUnit: "kg",
  cropType: "Café",
};

const toRows = async (
  features: ImportedFeature[],
  {
    language = "es",
    country = "CR",
    useNameAsId = false,
  }: { language?: TestLocale; country?: string | null; useNameAsId?: boolean } = {}
) => {
  const { t } = await createTestI18n(language);
  const { rows, errorMessages } = geoFeaturesToFarmRows(
    { format: useNameAsId ? "kml" : "geojson", features },
    t,
    language,
    country
  );
  return { data: rows, errorMessages };
};

/** A farm exported by Monbo's GeoJSON download, as /farms/import reads it back. */
const exported = (farm: Parameters<typeof generateGeoJsonFeature>[0]) => {
  const { properties, geometry } = generateGeoJsonFeature(farm);
  return feature(properties as ImportedFeature["properties"], {
    geometryType: geometry.type,
  });
};

describe("geoFeaturesToFarmRows", () => {
  it("uploads a GeoJSON exported by Monbo again with no edits", async () => {
    const farm = makePolygonFarm({
      id: "F07",
      producer: "Luis Mora",
      production: 1250.5,
      region: "Alajuela",
      association: "Coopetarrazú",
    });

    const { data, errorMessages } = await toRows([exported(farm)]);

    expect(errorMessages).toEqual([]);
    expect(data).toEqual([
      {
        id: "F07",
        producerName: "Luis Mora",
        productionDate: farm.productionDate,
        // Sent as a number: in Spanish, /farms/parse would read "1250.5" as 12505.
        productionQuantity: 1250.5,
        productionQuantityUnit: "kg",
        cropType: "Café",
        // The export writes Area "0": the point's default area applies.
        area: null,
        region: "Alajuela",
        association: "Coopetarrazú",
        documents: [],
        coordinatesFormat: "WKT",
        geometryType: "Polygon",
        farmCoordinates: POLYGON_WKT,
      },
    ]);
  });

  it("rejects a Monbo export from another country, like the template's column", async () => {
    const { errorMessages } = await toRows([exported(makeFarm({ country: "CO" }))], {
      country: "CR",
    });

    expect(errorMessages).toEqual([
      "Este archivo tiene fincas en Colombia. Monbo analiza un país a la vez: sube solo las fincas de Costa Rica, o elige otro país.",
    ]);
  });

  it("reads Shapefile names, ignoring case and spaces", async () => {
    const { data, errorMessages } = await toRows([
      feature({
        ID: 7,
        PRODUCTOR: " Ana Rojas ",
        FECHA_PROD: "2025-05-20",
        CANTIDAD: 300,
        unidad: "kg",
        Cultivo: "Cacao",
        AREA_HA: 2.5,
        REGION: "Cartago",
        ASOCIACION: "",
        PAIS: "cr",
      }),
    ]);

    expect(errorMessages).toEqual([]);
    expect(data[0]).toMatchObject({
      id: "7",
      producerName: "Ana Rojas",
      productionDate: "2025-05-20",
      productionQuantity: 300,
      productionQuantityUnit: "kg",
      cropType: "Cacao",
      area: 2.5,
      region: "Cartago",
      association: null,
    });
    expect(data[0]).not.toHaveProperty("country");
  });

  it("reads the template's Spanish and English headers too", async () => {
    const { data } = await toRows([
      feature({
        "Nombre productor": "Ana",
        "production date": "2025-05-20",
        "Cantidad producción": "1.234,5",
        "Production measurement unit": "kg",
        "Tipo de cultivo": "Cacao",
      }),
    ]);

    // Not a machine number: /farms/parse reads it in the user's locale.
    expect(data[0]).toMatchObject({
      producerName: "Ana",
      productionDate: "2025-05-20",
      productionQuantity: "1.234,5",
      productionQuantityUnit: "kg",
      cropType: "Cacao",
    });
  });

  it("takes the first accepted name that has a value", async () => {
    const { data } = await toRows([
      feature({ ...COMPLETE, productionQuantity: null, production: "850" }),
    ]);

    expect(data[0].productionQuantity).toBe(850);
  });

  it("names each missing mandatory attribute and the feature, in each language", async () => {
    const features = [
      feature({ id: "F-1", ...COMPLETE, producerName: null }),
      feature({ ...COMPLETE, cropType: "  " }, { position: 2 }),
    ];

    expect((await toRows(features, { language: "es" })).errorMessages).toEqual([
      "Falta dato obligatorio (producerName / PRODUCTOR) en el elemento 1 (ID F-1)",
      "Falta dato obligatorio (cropType / CULTIVO) en el elemento 2",
    ]);
    expect((await toRows(features, { language: "en" })).errorMessages).toEqual([
      "Missing mandatory data (producerName / PRODUCTOR) in feature 1 (ID F-1)",
      "Missing mandatory data (cropType / CULTIVO) in feature 2",
    ]);
  });

  it("uses a KML placemark's name as its id only when it has no id", async () => {
    const features = [
      feature({ Name: "Finca 1", ...COMPLETE }),
      feature({ Name: "Finca 2", id: "F-2", ...COMPLETE }, { position: 2 }),
    ];

    const kml = await toRows(features, { useNameAsId: true });
    const geoJson = await toRows(features);

    expect(kml.data.map((row) => row.id)).toEqual(["Finca 1", "F-2"]);
    expect(geoJson.data.map((row) => row.id)).toEqual([null, "F-2"]);
  });

  it("reports the API's per-feature geometry problems in the user's language", async () => {
    const line = feature(
      { id: "F-9", ...COMPLETE },
      {
        geometryType: null,
        farmCoordinates: null,
        errors: [
          {
            code: "unsupported_geometry",
            message: "The feature is a LineString",
            params: { geometryType: "LineString" },
          },
        ],
      }
    );

    expect((await toRows([line])).errorMessages).toEqual([
      "Hay un LineString en el elemento 1 (ID F-9): una finca debe ser un polígono o un punto",
    ]);
  });
});

describe("geoFeatureId", () => {
  it("reads the id attribute in any case, as trimmed text", () => {
    expect(geoFeatureId({ ID: " F-1 " }, false)).toBe("F-1");
    expect(geoFeatureId({ id: 7 }, false)).toBe("7");
  });

  it("falls back to the name only in a KML or KMZ", () => {
    expect(geoFeatureId({ Name: "Finca 1" }, true)).toBe("Finca 1");
    expect(geoFeatureId({ Name: "Finca 1" }, false)).toBeNull();
    expect(geoFeatureId({ id: "F-1", Name: "Finca 1" }, true)).toBe("F-1");
  });
});

describe("isGeoFile", () => {
  it("tells geo files from the Excel template by extension", () => {
    for (const name of ["a.geojson", "a.JSON", "a.kml", "a.KMZ", "a.zip"])
      expect(isGeoFile(new File([], name))).toBe(true);
    for (const name of ["a.xlsx", "a.xls", "a"])
      expect(isGeoFile(new File([], name))).toBe(false);
  });

  it("is accepted by the drop zone along with the template", () => {
    expect(Object.values(UPLOAD_FILE_ACCEPT).flat().sort()).toEqual(
      [".geojson", ".json", ".kml", ".kmz", ".xls", ".xlsx", ".zip"].sort()
    );
  });
});
