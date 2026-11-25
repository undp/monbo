import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { importGeoFile } from "@/api/farms";
import type { ImportedFile } from "@/interfaces/Farm";
import { deferred } from "@/test/deferred";
import { readPublicFile, toFile } from "@/test/files";
import { renderHookWithData } from "@/test/renderWithData";
import { getUploadFileTemplatePath } from "@/utils/excel";
import type { FarmRow } from "@/interfaces/FarmRow";
import {
  canAttachExcel,
  isUploadable,
  rereadSources,
  sourceErrors,
} from "@/utils/uploadSources";
import { useUploadSources } from "./useUploadSources";

vi.mock("@/api/farms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/farms")>()),
  importGeoFile: vi.fn(),
}));

// rereadSources is spied so a test can hold the country change's re-read open
vi.mock("@/utils/uploadSources", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/uploadSources")>();
  return { ...actual, rereadSources: vi.fn(actual.rereadSources) };
});
const { rereadSources: actualRereadSources } = await vi.importActual<
  typeof import("@/utils/uploadSources")
>("@/utils/uploadSources");

/** Holds the next re-read until the test releases it. */
const holdNextReread = () => {
  const gate = deferred<void>();
  vi.mocked(rereadSources).mockImplementationOnce(async (sources, context) => {
    await gate.promise;
    return actualRereadSources(sources, context);
  });
  return gate;
};

const MANUAL_ROW: FarmRow = {
  id: "F-9",
  producerName: "José Mora",
  productionDate: "2025-03-15",
  productionQuantity: 300,
  productionQuantityUnit: "kg",
  cropType: "Cacao",
  coordinatesFormat: "GeoJSON",
  geometryType: "Polygon",
  farmCoordinates: "[[[-84.37,10.14],[-84.36,10.14],[-84.36,10.15],[-84.37,10.14]]]",
  documents: [],
};

// A GeoJSON whose farm declares Colombia, as /farms/import reads it
const COLOMBIAN_FARM: ImportedFile = {
  format: "geojson",
  features: [
    {
      position: 1,
      properties: {
        id: "F-1",
        ProducerCountry: "CO",
        producerName: "María Muñoz",
        productionDate: "2025-03-15",
        productionQuantity: 1200,
        productionQuantityUnit: "kg",
        cropType: "Café",
      },
      geometryType: "Polygon",
      farmCoordinates:
        "POLYGON ((-74.1 4.6, -74.09 4.6, -74.09 4.61, -74.1 4.6))",
      errors: [],
    },
  ],
};

// A KMZ whose placemark declares Colombia and carries no data: its Excel brings it
const COLOMBIAN_PLACEMARK: ImportedFile = {
  format: "kmz",
  features: [
    {
      position: 1,
      properties: { Name: "F-1", PAIS: "CO" },
      geometryType: "Polygon",
      farmCoordinates:
        "POLYGON ((-74.1 4.6, -74.09 4.6, -74.09 4.61, -74.1 4.6))",
      errors: [],
    },
  ],
};

/** The production Excel (option 3's template) with one row, F-1. */
const productionExcel = () => {
  const bytes = readPublicFile(getUploadFileTemplatePath("es").replace(/^\//, ""));
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  XLSX.utils.sheet_add_aoa(
    sheet,
    [["F-1", "Ana Pérez", new Date(2024, 10, 25), 48.5, "kg", "Alajuela", null, null, null, 6.71, "Café"]],
    { origin: "A4", cellDates: true }
  );
  return toFile(XLSX.write(workbook, { type: "array", bookType: "xlsx" }), "datos.xlsx");
};

const OTHER_COUNTRY =
  "Este archivo tiene fincas en Colombia. Monbo analiza un país a la vez: sube solo las fincas de Costa Rica, o elige otro país.";

const renderUpload = (country: string | null) =>
  renderHookWithData(
    ({ selectedCountry }: { selectedCountry: string | null }) =>
      useUploadSources(selectedCountry),
    { initialProps: { selectedCountry: country } }
  );

beforeEach(() => {
  vi.mocked(importGeoFile).mockReset();
});

describe("useUploadSources", () => {
  it("reads the listed files again when the selected country changes", async () => {
    vi.mocked(importGeoFile).mockResolvedValue(COLOMBIAN_FARM);
    const { result, rerender } = await renderUpload("CO");

    await act(() =>
      result.current.addGeoFiles([toFile(new Uint8Array([1]), "fincas.geojson")])
    );
    expect(result.current.sources).toHaveLength(1);
    expect(isUploadable(result.current.sources[0])).toBe(true);

    // The user picks Costa Rica in the header: the file's farms are in Colombia
    rerender({ selectedCountry: "CR" });

    await waitFor(() =>
      expect(isUploadable(result.current.sources[0])).toBe(false)
    );
    expect(sourceErrors(result.current.sources[0])).toEqual([OTHER_COUNTRY]);
    expect(result.current.reading).toBe(false);

    // And back
    rerender({ selectedCountry: "CO" });
    await waitFor(() =>
      expect(isUploadable(result.current.sources[0])).toBe(true)
    );
  });

  it("checks a file whose read ends after the country changed against the new country", async () => {
    const imported = deferred<ImportedFile>();
    vi.mocked(importGeoFile).mockReturnValue(imported.promise);
    const { result, rerender } = await renderUpload("CO");

    // The file is still being read by the API when the user picks Costa Rica
    let adding!: Promise<void>;
    act(() => {
      adding = result.current.addGeoFiles([
        toFile(new Uint8Array([1]), "fincas.geojson"),
      ]);
    });
    expect(result.current.reading).toBe(true);
    rerender({ selectedCountry: "CR" });
    await act(async () => {
      imported.resolve(COLOMBIAN_FARM);
      await adding;
    });

    expect(result.current.sources).toHaveLength(1);
    expect(isUploadable(result.current.sources[0])).toBe(false);
    expect(sourceErrors(result.current.sources[0])).toEqual([OTHER_COUNTRY]);
    expect(result.current.reading).toBe(false);
  });

  it("checks an Excel attached while the country changed against the new country", async () => {
    vi.mocked(importGeoFile).mockResolvedValue(COLOMBIAN_PLACEMARK);
    const { result, rerender } = await renderUpload("CO");
    await act(() =>
      result.current.addGeoFiles([toFile(new Uint8Array([1]), "poligonos.kmz")])
    );
    const [source] = result.current.sources;
    if (!canAttachExcel(source)) throw new Error("expected a geo source");

    // The Excel is being read when the user picks Costa Rica
    let attaching!: Promise<void>;
    act(() => {
      attaching = result.current.attach(source, productionExcel());
    });
    rerender({ selectedCountry: "CR" });
    await act(() => attaching);

    const [joined] = result.current.sources;
    expect(canAttachExcel(joined) && joined.excel?.name).toBe("datos.xlsx");
    expect(isUploadable(joined)).toBe(false);
    expect(sourceErrors(joined)).toEqual([OTHER_COUNTRY]);
  });

  it("keeps an Excel detached while its geo file is being read again", async () => {
    vi.mocked(importGeoFile).mockResolvedValue(COLOMBIAN_PLACEMARK);
    const { result, rerender } = await renderUpload("CO");
    await act(() =>
      result.current.addGeoFileWithExcel(
        toFile(new Uint8Array([1]), "poligonos.kmz"),
        productionExcel()
      )
    );
    const [joined] = result.current.sources;
    if (!canAttachExcel(joined)) throw new Error("expected a geo source");
    expect(isUploadable(joined)).toBe(true);

    // The user removes the Excel while the file is being read again for CR
    const gate = holdNextReread();
    rerender({ selectedCountry: "CR" });
    expect(result.current.reading).toBe(true);
    act(() => result.current.detach(joined));
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.reading).toBe(false));

    const [source] = result.current.sources;
    expect(result.current.sources).toHaveLength(1);
    expect(canAttachExcel(source) && source.excel).toBeNull();
    // Without its Excel, and checked against Costa Rica
    expect(isUploadable(source)).toBe(false);
    expect(sourceErrors(source)).toEqual([OTHER_COUNTRY]);
  });

  it("keeps a manual farm saved while the files are being read again", async () => {
    vi.mocked(importGeoFile).mockResolvedValue(COLOMBIAN_FARM);
    const { result, rerender } = await renderUpload("CO");
    await act(() =>
      result.current.addGeoFiles([toFile(new Uint8Array([1]), "fincas.geojson")])
    );
    act(() => result.current.saveManual(MANUAL_ROW));
    const manualKey = result.current.sources[1].key;

    const gate = holdNextReread();
    rerender({ selectedCountry: "CR" });
    act(() =>
      result.current.saveManual({ ...MANUAL_ROW, id: "F-9 bis" }, manualKey)
    );
    await act(async () => gate.resolve());
    await waitFor(() => expect(result.current.reading).toBe(false));

    expect(result.current.sources[1]).toMatchObject({
      kind: "manual",
      row: { id: "F-9 bis" },
    });
    expect(sourceErrors(result.current.sources[0])).toEqual([OTHER_COUNTRY]);
  });
});
