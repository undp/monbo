import { useState } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { ReportContext } from "@/context/ReportContext";
import { useReportDownload } from "@/hooks/useReportDownload";
import { useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import type { FarmData } from "@/interfaces/Farm";
import { DownloadFormatModal } from "./DownloadFormatModal";

vi.mock("@/hooks/useReportDownload", () => ({ useReportDownload: vi.fn() }));
vi.mock("@/hooks/useGeoJsonDownload", () => ({ useGeoJsonDownload: vi.fn() }));

const gfw = makeMap({ id: 1, alias: "GFW" });
const tmf = makeMap({ id: 2, alias: "TMF" });
const farms = ["F01", "F02", "F03"].map((id) => makeFarm({ id }));
const results = [
  makeMapResults(1, { F01: 0.05, F02: 0, F03: 0 }),
  makeMapResults(2, { F01: 0, F02: 0, F03: 0 }),
];

const download = {
  downloadCompleteReport: vi.fn(async () => {}),
  downloadSeparatedReports: vi.fn(async () => {}),
  downloadLargeReport: vi.fn(async () => {}),
};
const saveGeoJson = vi.fn();
const onDownloadLargeReport = vi.fn();
const handleClose = vi.fn();

/** The modal over a real `downloadType`, as the flow keeps it. */
const Harness: React.FC<{ selectedFarms: FarmData[]; isLarge: boolean }> = ({
  selectedFarms,
  isLarge,
}) => {
  const [params, setParams] = useState<DataContextValue["reportGenerationParams"]>({
    seeded: true,
    selectedFarms,
    selectedMaps: [gfw],
    downloadType: null,
  });
  return (
    <DataContext.Provider
      value={makeDataContext({
        farmsData: farms,
        territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw, tmf] },
        territorialAnalysisResults: results,
        availableCategories: [makeCategory()],
        reportGenerationParams: params,
        setReportGenerationParams: setParams,
      })}
    >
      <ReportContext.Provider
        value={{
          previewUrl: null,
          previewState: "idle",
          isPreviewStale: false,
          isPreviewCurrent: false,
          previewInfo: null,
          requestPreview: vi.fn(),
          retryPreview: vi.fn(),
          getCompleteReport: vi.fn(),
          getSeparatedReports: vi.fn(),
          isLarge,
          farmCount: selectedFarms.length,
          satelliteLimit: null,
          buildLargeReportZip: vi.fn(),
        }}
      >
        <DownloadFormatModal
          isOpen
          handleClose={handleClose}
          onDownloadLargeReport={onDownloadLargeReport}
        />
      </ReportContext.Provider>
    </DataContext.Provider>
  );
};

const renderModal = async (selectedFarms: FarmData[] = farms, isLarge = false) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <Harness selectedFarms={selectedFarms} isLarge={isLarge} />
    </I18nextProvider>
  );
};

const button = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  vi.mocked(useReportDownload).mockReturnValue(download);
  vi.mocked(useGeoJsonDownload).mockReturnValue(saveGeoJson);
});

describe("DownloadFormatModal", () => {
  it("offers one PDF or a PDF per polygon for several polygons, the first one chosen", async () => {
    await renderModal();

    expect(screen.getByRole("dialog", { name: "Formato" })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.textContent)).toEqual([
      "Un PDF con todoUn archivo con todos los polígonos.",
      "Un PDF por polígonoSe descargan en un .zip.",
    ]);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);

    await act(async () => fireEvent.click(button("Descargar PDF")));

    expect(download.downloadCompleteReport).toHaveBeenCalledOnce();
    expect(download.downloadSeparatedReports).not.toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });

  it("downloads a PDF per polygon when chosen", async () => {
    await renderModal();

    fireEvent.click(screen.getByRole("radio", { name: /Un PDF por polígono/ }));
    await act(async () => fireEvent.click(button("Descargar PDF")));

    expect(download.downloadSeparatedReports).toHaveBeenCalledOnce();
    expect(download.downloadCompleteReport).not.toHaveBeenCalled();
  });

  it("moves the choice, and the focus, with the arrow keys", async () => {
    await renderModal();
    const [combined, separated] = screen.getAllByRole("radio");
    expect(combined.tabIndex).toBe(0);
    expect(separated.tabIndex).toBe(-1);

    fireEvent.keyDown(combined, { key: "ArrowDown" });

    expect(separated.getAttribute("aria-checked")).toBe("true");
    expect(separated.tabIndex).toBe(0);
    expect(document.activeElement).toBe(separated);
  });

  it("has no format choice for one polygon", async () => {
    await renderModal([farms[0]]);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText("El reporte del polígono F01.")).toBeTruthy();

    await act(async () => fireEvent.click(button("Descargar PDF")));
    expect(download.downloadCompleteReport).toHaveBeenCalledOnce();
  });

  it("offers only the ZIP of a large report, and says why", async () => {
    await renderModal(farms, true);

    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByText(/demasiado grande para un solo PDF/)).toBeTruthy();

    fireEvent.click(button("Descargar ZIP (3 PDFs)"));

    expect(handleClose).toHaveBeenCalled();
    expect(onDownloadLargeReport).toHaveBeenCalledOnce();
    expect(download.downloadCompleteReport).not.toHaveBeenCalled();
  });

  it.each([
    ["several polygons", farms, false],
    ["one polygon", [farms[0]], false],
    ["a large report", farms, true],
  ])("saves the GeoJSON of the ticked polygons and layers with %s", async (_, selected, large) => {
    await renderModal(selected, large);

    fireEvent.click(button("Descargar GeoJSON"));

    const [geoJson, filename] = saveGeoJson.mock.calls[0];
    expect(filename).toBe("report.geojson");
    expect(geoJson.features.map((f: { properties: { id: string } }) => f.properties.id)).toEqual(
      selected.map(({ id }) => id)
    );
    // Only the ticked layer: GFW, not TMF
    const keys = Object.keys(geoJson.features[0].properties).join(" ");
    expect(keys).toContain("GFW");
    expect(keys).not.toContain("TMF");
    expect(within(screen.getByRole("dialog")).getByText("Formato")).toBeTruthy();
  });
});
