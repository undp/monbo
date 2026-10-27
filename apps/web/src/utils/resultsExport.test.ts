import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { readPublicFile, toFile } from "@/test/files";
import { setRuntimeConfig } from "@/config/runtime";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { FarmData } from "@/interfaces/Farm";
import { InconsistentPolygonData } from "@/interfaces/PolygonValidation";
import { MapData } from "@/interfaces/DeforestationAnalysis";
import {
  SheetData,
  TEMPLATE_COLUMNS,
  generateExcel,
  getHeaderKey,
  getUploadFileTemplatePath,
  loadExcelFileFarmsData,
} from "./excel";
import { makeMultiPolygonFarm } from "@/test/factories";
import {
  FarmTooLargeForExcelError,
  buildDeforestationSheets,
  buildPolygonValidationSheets,
} from "./resultsExport";

// The Excel exports, written and read back the way users download and upload them.

const LOCALES: TestLocale[] = ["es", "en"];
const COUNTRY = "CR";
const RING = [
  { lng: -84.37, lat: 10.14 },
  { lng: -84.36, lat: 10.14 },
  { lng: -84.36, lat: 10.15 },
  { lng: -84.37, lat: 10.14 },
];

const POLYGON_FARM: FarmData = {
  id: "F01",
  producer: "Ana Pérez",
  producerId: "",
  cropType: "Café Arábica",
  productionDate: "2024-11-25T00:00:00.000Z",
  // A decimal quantity: written as text, a Spanish upload rejects "1200.5"
  production: 1200.5,
  productionQuantityUnit: "kg",
  country: COUNTRY,
  region: "Alajuela",
  association: "Cooperativa Tierra de Sabores",
  documents: [
    { name: "Declaración Jurada", url: "https://example.org/declaracion" },
  ],
  polygon: {
    type: "polygon",
    details: {
      center: { lng: -84.365, lat: 10.143 },
      parts: [{ exterior: RING, holes: [] }],
    },
    area: 67_100,
  },
};

const POINT_FARM: FarmData = {
  id: "F02",
  producer: "José Mora",
  producerId: "",
  cropType: "Cacao",
  productionDate: "2024-12-01T00:00:00.000Z",
  production: 300,
  productionQuantityUnit: "kg",
  country: COUNTRY,
  region: null,
  association: null,
  documents: [],
  polygon: {
    type: "point",
    details: { center: { lng: -84.1, lat: 10.1 }, radius: 89.2 },
    area: 25_000,
  },
};

// A small point: its area must survive the round trip as it is, since an upload
// takes a zero area as missing and gives the point the default 1 ha
const SMALL_POINT_FARM: FarmData = {
  id: "F03",
  producer: "Luisa Rojas",
  producerId: "",
  cropType: "Cacao",
  productionDate: "2024-12-01T00:00:00.000Z",
  production: 20,
  productionQuantityUnit: "kg",
  country: COUNTRY,
  region: null,
  association: null,
  documents: [],
  polygon: {
    type: "point",
    details: { center: { lng: -84.12, lat: 10.11 }, radius: 3.57 },
    area: 40,
  },
};

const FARMS = [POLYGON_FARM, POINT_FARM, SMALL_POINT_FARM];

// What uploading the export gives back for each farm
const UPLOADED = [
  {
    id: "F01",
    producerName: "Ana Pérez",
    productionDate: "2024-11-25T00:00:00.000Z",
    productionQuantity: 1200.5,
    productionQuantityUnit: "kg",
    region: "Alajuela",
    coordinatesFormat: "GeoJSON",
    geometryType: "Polygon",
    farmCoordinates: JSON.stringify([RING.map(({ lng, lat }) => [lng, lat])]),
    area: 6.71,
    cropType: "Café Arábica",
    association: "Cooperativa Tierra de Sabores",
    documents: [
      { name: "Declaración Jurada", url: "https://example.org/declaracion" },
    ],
  },
  {
    id: "F02",
    producerName: "José Mora",
    productionDate: "2024-12-01T00:00:00.000Z",
    productionQuantity: 300,
    productionQuantityUnit: "kg",
    region: null,
    coordinatesFormat: "GeoJSON",
    geometryType: "Point",
    farmCoordinates: "[-84.1,10.1]",
    area: 2.5,
    cropType: "Cacao",
    association: null,
    documents: [],
  },
  {
    id: "F03",
    producerName: "Luisa Rojas",
    productionDate: "2024-12-01T00:00:00.000Z",
    productionQuantity: 20,
    productionQuantityUnit: "kg",
    region: null,
    coordinatesFormat: "GeoJSON",
    geometryType: "Point",
    farmCoordinates: "[-84.12,10.11]",
    // 40 m², not rounded to 0 ha
    area: 0.004,
    cropType: "Cacao",
    association: null,
    documents: [],
  },
];

const OVERLAP: InconsistentPolygonData = {
  type: "overlap",
  farmIds: ["F01", "F02"],
  data: {
    area: 100,
    center: { lng: -84.2, lat: 10.12 },
    parts: [],
    percentage: 0.25,
    criticality: "MEDIUM",
  },
};

const LAYER = { id: 7, alias: "GFW" } as MapData;

// The exports fetch the template from public/files/, as the browser does. The
// percentages they write are labelled with the API's thresholds. The global setup
// resets both after each test.
beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
  vi.stubGlobal("fetch", async (url: string) => {
    const bytes = readPublicFile(url.replace(/^\//, ""));
    return { ok: true, arrayBuffer: async () => bytes.buffer };
  });
});

/** The export's sheet, written and read back as an .xlsx file. */
const writeAndRead = async (sheets: Record<string, SheetData>) => {
  const blob = await generateExcel(sheets);
  return XLSX.read(await blob.arrayBuffer(), { type: "array" });
};

/** The export uploaded as a farms file (the upload reads its first sheet). */
const upload = async (sheets: Record<string, SheetData>, locale: TestLocale) => {
  const blob = await generateExcel(sheets);
  const file = toFile(await blob.arrayBuffer(), "export.xlsx");
  const { t } = await createTestI18n(locale);
  return loadExcelFileFarmsData(file, t, locale, COUNTRY);
};

const validationSheets = async (locale: TestLocale) => {
  const { t } = await createTestI18n(locale);
  return buildPolygonValidationSheets(
    FARMS,
    FARMS,
    [OVERLAP],
    FARMS.map(({ id }) => ({ farmId: id, status: "VALID" as const })),
    t,
    locale
  );
};

const deforestationSheets = (locale: TestLocale) =>
  buildDeforestationSheets(
    FARMS,
    [
      {
        mapId: LAYER.id,
        version: 1,
        farmResults: FARMS.map(({ id }) => ({ farmId: id, value: 0.1 })),
      },
    ],
    [LAYER],
    locale
  );

describe.each(LOCALES)("the %s upload template", (locale) => {
  it("has the columns the exports write, in their order", () => {
    const bytes = readPublicFile(
      getUploadFileTemplatePath(locale).replace(/^\//, "")
    );
    const workbook = XLSX.read(bytes, { type: "array" });
    const [, headers] = XLSX.utils.sheet_to_json<string[]>(
      workbook.Sheets[workbook.SheetNames[0]],
      { header: 1 }
    );
    expect(headers.filter(Boolean).map(getHeaderKey)).toEqual([
      ...TEMPLATE_COLUMNS,
    ]);
  });
});

describe.each(LOCALES)("the %s Excel exports", (locale) => {
  it("uploads the validation export again with the same farms", async () => {
    expect(await upload(await validationSheets(locale), locale)).toEqual({
      data: UPLOADED,
      errorMessages: [],
    });
  });

  it("uploads the deforestation export again with every farm", async () => {
    expect(await upload(await deforestationSheets(locale), locale)).toEqual({
      data: UPLOADED,
      errorMessages: [],
    });
  });

  it("writes each value under its header", async () => {
    const workbook = await writeAndRead(await validationSheets(locale));
    const [, headers, , firstFarm] = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Polígonos válidos"],
      { header: 1, defval: "" }
    );
    const column = (key: string) =>
      headers.findIndex((h) => getHeaderKey(String(h)) === key);

    expect(firstFarm[column("region")]).toBe("Alajuela");
    expect(firstFarm[column("coordinatesFormat")]).toBe("GeoJSON");
    expect(firstFarm[column("geometryType")]).toBe("Polygon");
    expect(firstFarm[column("productionQuantity")]).toBe(1200.5);
    expect(headers[TEMPLATE_COLUMNS.length]).toBe(
      "Resultado Validación\nValidation Result"
    );
    expect(firstFarm[TEMPLATE_COLUMNS.length]).toBe("VALID");
  });

  it("puts the deforestation of each layer after the template's columns", async () => {
    const workbook = await writeAndRead(await deforestationSheets(locale));
    const [, headers, , firstFarm] = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets["Resultados de deforestación"],
      { header: 1, defval: "" }
    );
    expect(headers[TEMPLATE_COLUMNS.length]).toBe("Deforestación según GFW");
    expect(firstFarm[TEMPLATE_COLUMNS.length]).not.toBe("");
  });

  it("merges the overlap percentage in its own column", async () => {
    const sheet = (await validationSheets(locale))["Polígonos inconsistentes"];
    const percentageColumn = sheet.rows[1].indexOf(
      "Porcentaje de Traslape\nOverlap Percentage"
    );
    expect(sheet.merges).toEqual([
      { s: { r: 3, c: percentageColumn }, e: { r: 4, c: percentageColumn } },
    ]);
    expect(sheet.rows[3][percentageColumn]).toBe(sheet.rows[3].at(-1));
  });
});


describe.each(LOCALES)("the %s Excel export of holes and parts", (locale) => {
  const sheetsFor = async (farm: FarmData) => {
    const { t } = await createTestI18n(locale);
    return buildPolygonValidationSheets(
      [farm],
      [farm],
      [],
      [{ farmId: farm.id, status: "VALID" }],
      t,
      locale
    );
  };

  it("writes a farm of several parts as a GeoJSON MultiPolygon, uploaded again", async () => {
    const farm = makeMultiPolygonFarm({ id: "F09" });
    const { data, errorMessages } = await upload(await sheetsFor(farm), locale);
    expect(errorMessages).toEqual([]);
    const [row] = data;
    expect(row.geometryType).toBe("MultiPolygon");
    expect(JSON.parse(row.farmCoordinates as string)).toEqual(
      farm.polygon.type === "polygon" &&
        farm.polygon.details?.parts.map((part) =>
          [part.exterior, ...part.holes].map((ring) =>
            ring.map(({ lng, lat }) => [lng, lat])
          )
        )
    );
  });

  it("reports a farm too large for an Excel cell instead of cutting it", async () => {
    // About 40,000 characters of coordinates
    const exterior = Array.from({ length: 1500 }, (_, i) => ({
      lng: -84.123456789 + i * 1e-6,
      lat: 10.123456789,
    }));
    const farm = makeMultiPolygonFarm({ id: "F10" });
    if (farm.polygon.type === "polygon" && farm.polygon.details) {
      farm.polygon.details.parts = [{ exterior, holes: [] }];
    }
    await expect(sheetsFor(farm)).rejects.toEqual(
      new FarmTooLargeForExcelError("F10")
    );
  });
});
