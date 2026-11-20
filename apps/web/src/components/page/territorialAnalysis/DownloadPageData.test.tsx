import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext } from "@/context/DataContext";
import type { GeoJsonData } from "@/hooks/useGeoJsonDownload";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { readPublicFile } from "@/test/files";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import type { SheetData } from "@/utils/excel";
import { DownloadPageData } from "./DownloadPageData";

// What each download would save: the files themselves are covered in
// utils/resultsExport.test.ts and utils/geojson.test.ts.
const downloads = vi.hoisted(() => ({ excel: vi.fn(), geoJson: vi.fn() }));
vi.mock("@/hooks/useExcelDownload", () => ({
  useExcelDownload: () => downloads.excel,
}));
vi.mock("@/hooks/useGeoJsonDownload", () => ({
  useGeoJsonDownload: () => downloads.geoJson,
}));

const gfw = makeMap({ id: 1, alias: "GFW" });
// Its category was disabled after the analysis: GET /maps no longer lists it, and
// GET /categories no longer has its category.
const runap = makeMap({ id: 3, alias: "RUNAP", categoryId: "protected_areas" });

const context = makeDataContext({
  farmsData: [makeFarm({ id: "F01" })],
  territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw, runap] },
  territorialAnalysisResults: [
    makeMapResults(1, { F01: 0.05 }),
    makeMapResults(3, { F01: 0.5 }),
  ],
  availableMaps: [gfw],
  availableCategories: [makeCategory()],
});

const download = async (format: "Excel" | "GeoJSON") => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={context}>
        <DownloadPageData />
      </DataContext.Provider>
    </I18nextProvider>
  );
  fireEvent.click(screen.getByRole("button"));
  fireEvent.click(await screen.findByRole("menuitem", { name: format }));
};

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
  // The Excel export reads the upload template from public/files/, as the browser does
  vi.stubGlobal("fetch", async (url: string) => {
    const bytes = readPublicFile(url.replace(/^\//, ""));
    return { ok: true, arrayBuffer: async () => bytes.buffer };
  });
});

describe("DownloadPageData", () => {
  it("keeps in the Excel an analysed layer whose category was disabled", async () => {
    await download("Excel");
    await waitFor(() => expect(downloads.excel).toHaveBeenCalledOnce());

    const sheets = downloads.excel.mock.calls[0][0] as Record<string, SheetData>;
    const [, headers, , farm] = sheets["Análisis territorial"].rows;
    expect(headers.slice(-4)).toEqual([
      "Deforestación · GFW — % hallazgo",
      "Deforestación · GFW — Resultado",
      "Sin categoría · RUNAP — % hallazgo",
      "Sin categoría · RUNAP — Resultado",
    ]);
    expect(farm.slice(-4)).toEqual([5, "Con deforestación", "Sin dato", "Sin dato"]);
  });

  it("keeps it in the GeoJSON too", async () => {
    await download("GeoJSON");
    await waitFor(() => expect(downloads.geoJson).toHaveBeenCalledOnce());

    const data = downloads.geoJson.mock.calls[0][0] as GeoJsonData;
    expect(data.features[0].properties).toMatchObject({
      "Sin categoría · RUNAP — % hallazgo": "Sin dato",
      "Sin categoría · RUNAP — Resultado": "Sin dato",
    });
  });
});
