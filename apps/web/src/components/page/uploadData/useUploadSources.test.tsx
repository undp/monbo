import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importGeoFile } from "@/api/farms";
import type { ImportedFile } from "@/interfaces/Farm";
import { toFile } from "@/test/files";
import { renderHookWithData } from "@/test/renderWithData";
import { isUploadable, sourceErrors } from "@/utils/uploadSources";
import { useUploadSources } from "./useUploadSources";

vi.mock("@/api/farms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/farms")>()),
  importGeoFile: vi.fn(),
}));

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
    expect(sourceErrors(result.current.sources[0])).toEqual([
      "Este archivo tiene fincas en Colombia. Monbo analiza un país a la vez: sube solo las fincas de Costa Rica, o elige otro país.",
    ]);
    expect(result.current.reading).toBe(false);

    // And back
    rerender({ selectedCountry: "CO" });
    await waitFor(() =>
      expect(isUploadable(result.current.sources[0])).toBe(true)
    );
  });
});
