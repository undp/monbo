import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { GeoImportRequestError, importGeoFile } from "@/api/farms";
import type { ImportedFeature, ImportedFile } from "@/interfaces/Farm";
import { readPublicFile, toFile } from "@/test/files";
import { createTestI18n } from "@/test/i18n";
import { getUploadFileTemplatePath } from "./excel";
import {
  ManualSource,
  UploadSource,
  attachExcel,
  canAttachExcel,
  collectUpload,
  detachExcel,
  isUploadable,
  newSourceKey,
  readFileSource,
  readGeoFileWithExcel,
  sourceErrors,
  sourceProblem,
  sourceRows,
  uploadSummary,
  uploadSummaryText,
} from "./uploadSources";

vi.mock("@/api/farms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/farms")>()),
  importGeoFile: vi.fn(),
}));

const POLYGON_WKT =
  "POLYGON ((-84.023 9.8783, -84.0201 9.879, -84.0195 9.8761, -84.023 9.8783))";
const GEOJSON_POLYGON =
  "[[[-84.37,10.14],[-84.36,10.14],[-84.36,10.15],[-84.37,10.14]]]";

// A template row (the columns of row 2) with the given ID and coordinate cells.
const templateRow = (id: string | null, coordinates: (string | null)[]) => [
  id,
  "Ana Pérez",
  new Date(2024, 10, 25),
  48.5,
  "kg",
  "Alajuela",
  ...coordinates,
  6.71,
  "Café",
];

const excel = (rows: unknown[][], name = "datos.xlsx") => {
  const bytes = readPublicFile(getUploadFileTemplatePath("es").replace(/^\//, ""));
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: "A4", cellDates: true });
  return toFile(XLSX.write(workbook, { type: "array", bookType: "xlsx" }), name);
};

const feature = (
  position: number,
  properties: ImportedFeature["properties"]
): ImportedFeature => ({
  position,
  properties,
  geometryType: "Polygon",
  farmCoordinates: POLYGON_WKT,
  errors: [],
});

const COMPLETE = {
  producerName: "María Muñoz",
  productionDate: "2025-03-15",
  productionQuantity: 1200,
  productionQuantityUnit: "kg",
  cropType: "Café",
};

const geoFile = (name: string, imported: ImportedFile) => {
  vi.mocked(importGeoFile).mockResolvedValueOnce(imported);
  return toFile(new Uint8Array([1]), name);
};

const manual = (id: string | null): ManualSource => ({
  kind: "manual",
  key: newSourceKey(),
  row: {
    id,
    ...COMPLETE,
    coordinatesFormat: "GeoJSON",
    geometryType: "Polygon",
    farmCoordinates: GEOJSON_POLYGON,
    documents: [],
  },
});

const context = async () => ({
  ...(await createTestI18n("es")),
  language: "es",
  selectedCountry: "CR",
});

beforeEach(() => {
  vi.mocked(importGeoFile).mockReset();
});

describe("readFileSource", () => {
  it("reads the Excel template with its coordinates, as always", async () => {
    const source = await readFileSource(
      excel([templateRow("F01", ["GeoJSON", "Polygon", GEOJSON_POLYGON])]),
      await context()
    );

    expect(source.kind).toBe("excel");
    expect(sourceErrors(source)).toEqual([]);
    expect(sourceRows(source)).toMatchObject([
      { id: "F01", coordinatesFormat: "GeoJSON", farmCoordinates: GEOJSON_POLYGON },
    ]);
    expect(importGeoFile).not.toHaveBeenCalled();
  });

  it("explains that an Excel without coordinates is joined to a geo file", async () => {
    const source = await readFileSource(
      excel([templateRow("F01", [null, null, null])]),
      await context()
    );

    expect(sourceErrors(source)).toEqual([
      "Este Excel no tiene coordenadas. Si tus polígonos están en un archivo geográfico, súbelos junto a este Excel en la opción 3; si no, completa sus columnas de coordenadas.",
    ]);
    expect(isUploadable(source)).toBe(false);
  });

  it("reads a geo file's farms from its attributes", async () => {
    const source = await readFileSource(
      geoFile("fincas.geojson", {
        format: "geojson",
        features: [feature(1, { id: "F-1", ...COMPLETE })],
      }),
      await context()
    );

    expect(source.kind).toBe("geo");
    expect(isUploadable(source)).toBe(true);
    expect(sourceRows(source)).toMatchObject([
      { id: "F-1", producerName: "María Muñoz", farmCoordinates: POLYGON_WKT },
    ]);
  });

  it("lists a geo file without the farms' data, and lets an Excel be attached", async () => {
    const source = await readFileSource(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1" })],
      }),
      await context()
    );

    expect(isUploadable(source)).toBe(false);
    expect(sourceErrors(source)[0]).toBe(
      "Falta dato obligatorio (producerName / PRODUCTOR) en el elemento 1 (ID F-1)"
    );
    expect(canAttachExcel(source)).toBe(true);
  });

  it("says why the API rejected a geo file", async () => {
    vi.mocked(importGeoFile).mockRejectedValueOnce(
      new GeoImportRequestError({
        code: "missing_prj",
        message: "No .prj",
        params: { layer: "fincas.shp" },
      })
    );
    const source = await readFileSource(
      toFile(new Uint8Array([1]), "fincas.zip"),
      await context()
    );

    expect(sourceErrors(source)).toEqual([
      "Al Shapefile fincas.shp le falta su archivo .prj, que indica el sistema de coordenadas. Inclúyelo en el .zip",
    ]);
    expect(canAttachExcel(source)).toBe(false);
  });
});

describe("attachExcel", () => {
  it("joins the Excel to the geo file by ID, ignoring its coordinates", async () => {
    const ctx = await context();
    const source = await readFileSource(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1" }), feature(2, { Name: "F-2" })],
      }),
      ctx
    );
    if (!canAttachExcel(source)) throw new Error("expected a geo source");

    const joined = await attachExcel(
      source,
      excel([
        templateRow("F-2", ["WKT", "Point", "POINT (0 0)"]),
        templateRow("F-1", [null, null, null]),
      ]),
      ctx
    );

    expect(sourceErrors(joined)).toEqual([]);
    expect(sourceRows(joined)).toMatchObject([
      { id: "F-2", coordinatesFormat: "WKT", farmCoordinates: POLYGON_WKT },
      { id: "F-1", farmCoordinates: POLYGON_WKT },
    ]);
    // Removing the Excel goes back to the attributes, which lack the data
    expect(isUploadable(detachExcel(joined))).toBe(false);
  });

  it("reports the IDs that don't match", async () => {
    const ctx = await context();
    const source = await readFileSource(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-005" })],
      }),
      ctx
    );
    if (!canAttachExcel(source)) throw new Error("expected a geo source");

    const joined = await attachExcel(
      source,
      excel([templateRow("F-050", [null, null, null])]),
      ctx
    );

    expect(sourceErrors(joined)).toEqual([
      "La fila 4 del Excel (ID F-050) no tiene geometría en el archivo geográfico",
      "El elemento 1 (ID F-005) no tiene fila en el Excel",
    ]);
  });
});

describe("collectUpload", () => {
  it("sends every source's farms together, in list order", async () => {
    const ctx = await context();
    const file = await readFileSource(
      excel([templateRow("F01", ["GeoJSON", "Polygon", GEOJSON_POLYGON])]),
      ctx
    );

    const { rows, errorMessages } = collectUpload(
      [file, manual("M-1"), manual(null)],
      ctx.t
    );

    expect(errorMessages).toEqual([]);
    expect(rows.map((row) => row.id)).toEqual(["F01", "M-1", null]);
  });

  it("names both sources of a duplicated ID", async () => {
    const ctx = await context();
    const file = await readFileSource(
      excel([templateRow("F01", ["GeoJSON", "Polygon", GEOJSON_POLYGON])]),
      ctx
    );

    const { rows, errorMessages } = collectUpload([file, manual("F01")], ctx.t);

    expect(rows).toEqual([]);
    expect(errorMessages).toEqual([
      "El ID F01 está en más de una fuente (datos.xlsx, Finca F01 (agregada manualmente)): quita o corrige una de ellas.",
    ]);
  });

  it("finds a duplicated ID when the same file is dropped twice", async () => {
    const ctx = await context();
    const drop = () =>
      readFileSource(
        excel([templateRow("F01", ["GeoJSON", "Polygon", GEOJSON_POLYGON])]),
        ctx
      );

    const { errorMessages } = collectUpload([await drop(), await drop()], ctx.t);

    expect(errorMessages).toEqual([
      "El ID F01 está en más de una fuente (datos.xlsx, datos.xlsx): quita o corrige una de ellas.",
    ]);
  });

  it("names the source of each error", async () => {
    const ctx = await context();
    const file = await readFileSource(
      excel([templateRow("F01", [null, null, null])], "sin_coordenadas.xlsx"),
      ctx
    );

    const { errorMessages } = collectUpload([file], ctx.t);

    expect(errorMessages[0]).toMatch(/^sin_coordenadas\.xlsx: Este Excel no tiene/);
  });
});

describe("sourceProblem", () => {
  it("says which data a geo file misses and how to bring it", async () => {
    const ctx = await context();
    const source = await readFileSource(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1" }), feature(2, { Name: "F-2" })],
      }),
      ctx
    );

    expect(sourceProblem(source, ctx.t)).toBe(
      "Faltan datos en 2 elementos (nombre productor, fecha producción, cantidad producción, unidad cantidad producción, tipo de cultivo). Adjunta el Excel de producción con sus IDs, o agrega esos atributos al archivo."
    );
  });

  it("says how many IDs don't match, and the rule", async () => {
    const ctx = await context();
    const source = await readGeoFileWithExcel(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-005" })],
      }),
      excel([templateRow("F-050", [null, null, null])]),
      ctx
    );

    expect(sourceProblem(source, ctx.t)).toBe(
      "2 IDs no cruzan entre el archivo y el Excel: el ID de cada polígono (en un KML, su nombre) debe ser el ID de su fila."
    );
  });

  it("is the first error otherwise, and nothing for a source that uploads", async () => {
    const ctx = await context();
    expect(sourceProblem(manual("M-1"), ctx.t)).toBeNull();
  });
});

describe("uploadSummary", () => {
  it("counts the uploadable farms by kind, and the sources with problems", async () => {
    const ctx = await context();
    const point: ManualSource = {
      ...manual("M-2"),
      row: { ...manual("M-2").row, geometryType: "Point", farmCoordinates: "[-84,10]" },
    };
    const missing = await readFileSource(
      geoFile("poligonos.kmz", { format: "kmz", features: [feature(1, { Name: "F-1" })] }),
      ctx
    );
    const sources: UploadSource[] = [manual("M-1"), point, missing];

    const summary = uploadSummary(sources);

    expect(summary).toEqual({ farms: 2, polygons: 1, points: 1, sourcesWithProblems: 1 });
    expect(uploadSummaryText(summary, ctx.t)).toBe(
      "2 fincas: 1 polígono y 1 punto · 1 fuente con problemas"
    );
    const { t: en } = await createTestI18n("en");
    expect(
      uploadSummaryText({ farms: 10, polygons: 9, points: 1, sourcesWithProblems: 1 }, en)
    ).toBe("10 farms: 9 polygons and 1 point · 1 source with problems");
    expect(
      uploadSummaryText({ farms: 5, polygons: 5, points: 0, sourcesWithProblems: 0 }, ctx.t)
    ).toBe("5 fincas: 5 polígonos");
  });
});
