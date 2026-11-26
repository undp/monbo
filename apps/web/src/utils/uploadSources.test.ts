import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { GeoImportRequestError, importGeoFile } from "@/api/farms";
import type { ImportedFeature, ImportedFile } from "@/interfaces/Farm";
import { readPublicFile, toFile } from "@/test/files";
import { createTestI18n } from "@/test/i18n";
import { getUploadFileTemplatePath, loadExcelFileFarmsData } from "./excel";
import {
  GeoSource,
  ManualSource,
  UploadSource,
  attachExcel,
  canAttachExcel,
  collectUpload,
  detachExcel,
  isMissingData,
  isReadForCountry,
  isUploadable,
  newSourceKey,
  readFileSource,
  readGeoFileWithExcel,
  rereadSources,
  rowMark,
  sourceErrors,
  sourceListedRows,
  sourceMissing,
  sourceProblem,
  sourceRows,
  uploadSummary,
  uploadSummaryText,
  withoutRow,
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

const excel = (rows: unknown[][], name = "datos.xlsx", countries?: string[]) => {
  const bytes = readPublicFile(getUploadFileTemplatePath("es").replace(/^\//, ""));
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  XLSX.utils.sheet_add_aoa(sheet, rows, { origin: "A4", cellDates: true });
  if (countries) {
    // An older template's country column, after the template's 11 columns
    XLSX.utils.sheet_add_aoa(sheet, [["País"]], { origin: "L2" });
    XLSX.utils.sheet_add_aoa(
      sheet,
      countries.map((country) => [country]),
      { origin: "L4" }
    );
  }
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

const context = async (selectedCountry = "CR") => ({
  ...(await createTestI18n("es")),
  language: "es",
  selectedCountry,
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
      "Este Excel no tiene coordenadas. Si tus fincas están en un archivo geográfico, súbelo junto a este Excel en «Archivo geográfico + Excel»; si no, completa sus columnas de coordenadas.",
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
  it("joins the Excel to the geo file by ID, with its coordinate columns empty", async () => {
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
        templateRow("F-2", [null, "Point", null]),
        templateRow("F-1", [null, null, null]),
      ]),
      ctx
    );

    expect(sourceErrors(joined)).toEqual([]);
    expect(sourceRows(joined)).toMatchObject([
      { id: "F-2", geometryType: "Polygon", farmCoordinates: POLYGON_WKT },
      { id: "F-1", farmCoordinates: POLYGON_WKT },
    ]);
    // Removing the Excel goes back to the attributes, which lack the data
    expect(isUploadable(detachExcel(joined))).toBe(false);
  });

  it("rejects an Excel with coordinates: the geo file places the farms", async () => {
    const ctx = await context();
    const drop = () =>
      readGeoFileWithExcel(
        geoFile("poligonos.kmz", {
          format: "kmz",
          features: [feature(1, { Name: "F-1" }), feature(2, { Name: "F-2" })],
        }),
        excel([
          templateRow("F-1", ["WKT", "Polygon", POLYGON_WKT]),
          templateRow("F-2", [null, null, null]),
        ]),
        ctx
      );

    const source = await drop();
    expect(sourceErrors(source)).toEqual([
      "Este Excel tiene coordenadas en 1 fila. Junto a un archivo geográfico, la ubicación de cada finca sale del archivo: usa la plantilla de «Archivo geográfico + Excel», que no tiene coordenadas, o borra las del Excel. Si las coordenadas correctas son las del Excel, súbelo solo en «Plantilla Excel».",
    ]);
    expect(sourceRows(source)).toEqual([]);
    expect(isUploadable(source)).toBe(false);
    // The geo file stays listed: its Excel can be removed and another attached
    expect(canAttachExcel(source)).toBe(true);
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

  it("tags each farm with its origin, for /farms/parse to echo", async () => {
    const ctx = await context();
    const file = await readFileSource(
      excel([templateRow("F01", ["GeoJSON", "Polygon", GEOJSON_POLYGON])], "lote.xlsx"),
      ctx
    );
    const joined = await readGeoFileWithExcel(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1" })],
      }),
      excel([templateRow("F-1", [null, null, null])]),
      ctx
    );
    const geo = await readFileSource(
      geoFile("fincas.geojson", {
        format: "geojson",
        features: [feature(1, { id: "G-1", ...COMPLETE })],
      }),
      ctx
    );

    const { rows } = collectUpload([file, joined, geo, manual("M-1")], ctx.t);

    expect(rows.map((row) => row.origin)).toEqual([
      { method: "excel", fileName: "lote.xlsx" },
      { method: "geoFileWithExcel", fileName: "poligonos.kmz" },
      { method: "geoFile", fileName: "fincas.geojson" },
      { method: "manual", fileName: null },
    ]);
  });

  it("leaves out the farms deleted from the list", async () => {
    const ctx = await context();
    const file = await readFileSource(
      excel([
        templateRow("F01", ["GeoJSON", "Polygon", GEOJSON_POLYGON]),
        templateRow("F02", ["GeoJSON", "Polygon", GEOJSON_POLYGON]),
      ]),
      ctx
    );

    const { rows } = collectUpload([withoutRow(file, 0)!], ctx.t);

    expect(rows.map((row) => row.id)).toEqual(["F02"]);
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
      "2 IDs no coinciden entre los polígonos y el Excel: el ID de cada polígono (en un KML, su nombre) debe ser el ID de su fila."
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

describe("rereadSources", () => {
  const OTHER_COUNTRY =
    "Este archivo tiene fincas en Colombia. Monbo analiza un país a la vez: sube solo las fincas de Costa Rica, o elige otro país.";

  it("checks a geo file's country against the new selected country", async () => {
    const source = await readFileSource(
      geoFile("fincas.geojson", {
        format: "geojson",
        features: [feature(1, { id: "F-1", ProducerCountry: "CO", ...COMPLETE })],
      }),
      await context("CO")
    );
    expect(isUploadable(source)).toBe(true);

    const [inCostaRica] = await rereadSources([source], await context("CR"));
    expect(inCostaRica.key).toBe(source.key);
    expect(isReadForCountry(source, "CR")).toBe(false);
    expect(isReadForCountry(inCostaRica, "CR")).toBe(true);
    expect(isUploadable(inCostaRica)).toBe(false);
    expect(sourceErrors(inCostaRica)).toEqual([OTHER_COUNTRY]);
    // Without calling the API again
    expect(importGeoFile).toHaveBeenCalledTimes(1);

    const [backInColombia] = await rereadSources([inCostaRica], await context("CO"));
    expect(isUploadable(backInColombia)).toBe(true);
  });

  it("checks a joined geo file's country again, keeping its Excel", async () => {
    const source = await readGeoFileWithExcel(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1", PAIS: "CO" })],
      }),
      excel([templateRow("F-1", [null, null, null])]),
      await context("CO")
    );
    expect(isUploadable(source)).toBe(true);

    const [reread] = await rereadSources([source], await context("CR"));
    expect(isUploadable(reread)).toBe(false);
    expect(sourceErrors(reread)).toEqual([OTHER_COUNTRY]);
    expect(canAttachExcel(reread) && reread.excel?.name).toBe("datos.xlsx");
  });

  it("keeps manual farms and rejected files as they are", async () => {
    vi.mocked(importGeoFile).mockRejectedValueOnce(new Error("down"));
    const rejected = await readFileSource(
      toFile(new Uint8Array([1]), "fincas.zip"),
      await context("CO")
    );
    const drawn = manual("F-9");

    const reread = await rereadSources([rejected, drawn], await context("CR"));
    // The rejected file is only marked as checked for the new country
    expect(reread).toEqual([{ ...rejected, readFor: "CR" }, drawn]);
    expect(importGeoFile).toHaveBeenCalledTimes(1);
  });
});

describe("withoutRow", () => {
  const threeFarms = async (selectedCountry = "CR") =>
    readFileSource(
      geoFile("fincas.geojson", {
        format: "geojson",
        features: [1, 2, 3].map((n) =>
          feature(n, { id: `G-${n}`, ProducerCountry: "CO", ...COMPLETE })
        ),
      }),
      await context(selectedCountry)
    );

  it("removes one farm and keeps the others with their positions", async () => {
    const source = withoutRow(await threeFarms("CO"), 1)!;

    expect(sourceListedRows(source).map(({ row, index }) => [row.id, index])).toEqual([
      ["G-1", 0],
      ["G-3", 2],
    ]);
    expect(uploadSummary([source]).farms).toBe(2);
  });

  it("keeps the deleted farm out when the file is read for another country", async () => {
    const source = withoutRow(await threeFarms("CO"), 0)!;

    const [inCostaRica] = await rereadSources([source], await context("CR"));
    const [backInColombia] = await rereadSources([inCostaRica], await context("CO"));

    expect(sourceRows(backInColombia).map((row) => row.id)).toEqual(["G-2", "G-3"]);
  });

  it("keeps the deleted farm out of a joined Excel read again", async () => {
    const source = await readGeoFileWithExcel(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1" }), feature(2, { Name: "F-2" })],
      }),
      excel([
        templateRow("F-1", [null, null, null]),
        templateRow("F-2", [null, null, null]),
      ]),
      await context("CO")
    );
    const [reread] = await rereadSources(
      [withoutRow(source, 0)!],
      await context("CR")
    );

    expect(sourceListedRows(reread).map(({ index }) => index)).toEqual([1]);
  });

  it("starts over when an Excel is detached, since the rows change", async () => {
    const source = await readGeoFileWithExcel(
      geoFile("poligonos.kmz", {
        format: "kmz",
        features: [feature(1, { Name: "F-1", ...COMPLETE })],
      }),
      excel([templateRow("F-1", [null, null, null])]),
      await context()
    );
    const left = withoutRow(source, 0);
    expect(left).toBeNull();

    const detached = detachExcel(source);
    expect(detached.kind === "geo" && detached.removedRows).toEqual([]);
  });

  it("drops the source with its last farm, and a manual farm at once", async () => {
    let source: UploadSource | null = await threeFarms();
    source = withoutRow(source, 0);
    source = withoutRow(source!, 1);
    expect(source).not.toBeNull();
    expect(withoutRow(source!, 2)).toBeNull();
    expect(withoutRow(manual("M-1"), 0)).toBeNull();
  });
});

describe("a deleted row's problems", () => {
  const INVALID = ["GeoJSON", "Polygon", "[[malformed"];
  const VALID = ["GeoJSON", "Polygon", GEOJSON_POLYGON];
  // Row 5 of the template is the second farm
  const threeFarms = async (selectedCountry = "CR") =>
    readFileSource(
      excel([
        templateRow("F01", VALID),
        templateRow("F02", INVALID),
        templateRow("F03", VALID),
      ]),
      await context(selectedCountry)
    );
  const peruFarm = async (selectedCountry = "CO") =>
    readFileSource(
      excel(
        [templateRow("F01", VALID), templateRow("F02", VALID)],
        "datos.xlsx",
        ["CO", "PE"]
      ),
      await context(selectedCountry)
    );

  it("clears an Excel's error when the row that causes it is deleted", async () => {
    const source = await threeFarms();
    expect(sourceErrors(source)).toHaveLength(1);
    expect(isUploadable(source)).toBe(false);

    const left = withoutRow(source, 1)!;

    expect(sourceErrors(left)).toEqual([]);
    expect(isUploadable(left)).toBe(true);
    expect(sourceProblem(left, (await context()).t)).toBeNull();
    expect(uploadSummary([left])).toMatchObject({ farms: 2, sourcesWithProblems: 0 });
  });

  it("keeps the error of row 5 when another row is deleted", async () => {
    const left = withoutRow(await threeFarms(), 0)!;

    expect(sourceErrors(left)).toEqual([
      "Coordenadas inválidas en la fila 5",
    ]);
    expect(isUploadable(left)).toBe(false);
    expect(uploadSummary([left]).sourcesWithProblems).toBe(1);
  });

  it("clears the other-country error when the row of that country is deleted", async () => {
    const source = await peruFarm();
    expect(sourceErrors(source)).toHaveLength(1);
    expect(isUploadable(source)).toBe(false);

    const left = withoutRow(source, 1)!;

    expect(sourceErrors(left)).toEqual([]);
    expect(isUploadable(left)).toBe(true);
  });

  it("clears a geo file's missing data when the features that miss it are deleted", async () => {
    const source = await readFileSource(
      geoFile("fincas.geojson", {
        format: "geojson",
        features: [
          feature(1, { id: "G-1", ...COMPLETE }),
          feature(2, { id: "G-2", ...COMPLETE, producerName: null }),
          feature(3, { id: "G-3", ...COMPLETE }),
        ],
      }),
      await context()
    );
    const { t } = await context();
    expect(isMissingData(source)).toBe(true);
    expect(sourceProblem(source, t)).toContain("1");

    const left = withoutRow(source, 1)!;

    expect(isMissingData(left)).toBe(false);
    expect(sourceProblem(left, t)).toBeNull();
    expect(sourceErrors(left)).toEqual([]);
    expect(isUploadable(left)).toBe(true);
    expect(sourceMissing(left as GeoSource)).toEqual({ attributes: [], features: 0 });
  });

  it("keeps the deleted row's error dropped when the file is read again", async () => {
    const source = withoutRow(await threeFarms("CR"), 1)!;

    const [other] = await rereadSources([source], await context("CO"));
    const [back] = await rereadSources([other], await context("CR"));

    expect(sourceErrors(other)).toEqual([]);
    expect(sourceErrors(back)).toEqual([]);
    expect(isUploadable(back)).toBe(true);
  });

  it("brings back the error of a row that is still listed when the file is read again", async () => {
    const source = withoutRow(await threeFarms("CR"), 0)!;

    const [reread] = await rereadSources([source], await context("CO"));

    expect(sourceErrors(reread)).toEqual([
      "Coordenadas inválidas en la fila 5",
    ]);
  });
});

describe("loadExcelFileFarmsData's row problems", () => {
  it("flags the row of another country alone and still validates the other rows", async () => {
    const { t } = await context("CO");
    const { rowProblems, errorMessages } = await loadExcelFileFarmsData(
      excel(
        [
          templateRow("F01", ["GeoJSON", "Polygon", "[[malformed"]),
          templateRow("F02", ["GeoJSON", "Polygon", GEOJSON_POLYGON]),
        ],
        "datos.xlsx",
        ["CO", "PE"]
      ),
      t,
      "es",
      "CO"
    );

    expect(rowProblems).toHaveLength(2);
    expect(rowProblems[0].otherCountry).toBeNull();
    expect(rowProblems[0].errors).toEqual([
      "Coordenadas inválidas en la fila 4",
    ]);
    expect(rowProblems[1].otherCountry).toContain("Perú");
    expect(rowProblems[1].errors).toEqual([]);
    expect(errorMessages[0]).toBe(rowProblems[1].otherCountry);
    expect(errorMessages).toHaveLength(2);
  });
});

describe("rowMark", () => {
  const INVALID = ["GeoJSON", "Polygon", "[[malformed"];
  const VALID = ["GeoJSON", "Polygon", GEOJSON_POLYGON];

  it("lists an Excel row's other-country message first, then its error, as bad", async () => {
    const source = await readFileSource(
      excel(
        [templateRow("F01", VALID), templateRow("F02", INVALID)],
        "datos.xlsx",
        ["CO", "PE"]
      ),
      await context("CO")
    );

    const mark = rowMark(source, 1);

    expect(mark?.tone).toBe("bad");
    expect(mark?.messages).toHaveLength(2);
    expect(mark?.messages[0]).toBe(source.kind === "excel" && source.rowProblems[1].otherCountry);
    expect(mark?.messages[1]).toBe(source.kind === "excel" && source.rowProblems[1].errors[0]);
    expect(rowMark(source, 0)).toBeNull();
  });

  it("gives null to an Excel row without problems", async () => {
    const source = await readFileSource(
      excel([templateRow("F01", VALID)]),
      await context()
    );

    expect(rowMark(source, 0)).toBeNull();
  });

  it("gives a geo file's feature its own problems, warn when only data is missing", async () => {
    const source = await readFileSource(
      geoFile("lotes.geojson", {
        format: "geojson",
        features: [
          feature(1, { id: "G-1", ...COMPLETE }),
          feature(2, { id: "G-2", ...COMPLETE, producerName: null }),
          {
            ...feature(3, { id: "G-3", ...COMPLETE }),
            geometryType: null,
            farmCoordinates: null,
            errors: [
              {
                code: "unsupported_geometry",
                message: "The feature is a LineString",
                params: { geometryType: "LineString" },
              },
            ],
          },
        ],
      }),
      await context()
    );

    expect(rowMark(source, 0)).toBeNull();
    expect(rowMark(source, 1)).toMatchObject({ tone: "warn" });
    expect(rowMark(source, 1)?.messages).toHaveLength(1);
    expect(rowMark(source, 2)).toMatchObject({ tone: "bad" });
  });

  it("gives null to a geo file with a joined Excel and to a manual source", async () => {
    const withMissing = await readFileSource(
      geoFile("lotes.geojson", {
        format: "geojson",
        features: [feature(1, { id: "G-1", ...COMPLETE, producerName: null })],
      }),
      await context()
    );
    expect(rowMark(withMissing, 0)).not.toBeNull();
    if (withMissing.kind !== "geo") throw new Error("expected a geo source");
    const joined = {
      ...withMissing,
      excel: { name: "datos.xlsx", file: toFile(new Uint8Array([1]), "datos.xlsx"), rows: [], errorMessages: [] },
    } as unknown as GeoSource;

    expect(rowMark(joined, 0)).toBeNull();
    expect(rowMark(manual("M-1"), 0)).toBeNull();
  });
});
