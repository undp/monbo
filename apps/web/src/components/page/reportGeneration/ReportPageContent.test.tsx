import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { sendUsageEvent } from "@/api/usageEvents";
import { setRuntimeConfig } from "@/config/runtime";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { setParams, setPathname, setSearchParams } from "@/test/navigation";
import { stubObjectUrls } from "@/test/objectUrls";
import { makeCategory, makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { fetchLayerImages } from "@/utils/layerImages";
import type { FarmData } from "@/interfaces/Farm";
import { ReportPageContent } from "./ReportPageContent";

const client = vi.hoisted(() => ({ render: vi.fn(), terminate: vi.fn() }));
vi.mock("@/workers/reportPdfClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/workers/reportPdfClient")>()),
  ReportPdfClient: class {
    render = client.render;
    terminate = client.terminate;
  },
}));
vi.mock("@/utils/layerImages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/layerImages")>()),
  fetchLayerImages: vi.fn(),
}));
vi.mock("@/api/usageEvents", () => ({ sendUsageEvent: vi.fn() }));

const deforestation = makeCategory({ thresholdPercentage: 1 });
const gfw = makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW" });
const tmf = makeMap({ id: 2, name: "Tropical Moist Forests", alias: "TMF" });
const f1 = makeFarm({ id: "F01", producer: "Ana Pérez" });
const f2 = makeFarm({ id: "F02", producer: "Bruno Soto" });

type ReportParams = DataContextValue["reportGenerationParams"];
const UNSEEDED: ReportParams = {
  seeded: false,
  selectedMaps: [],
  selectedFarms: [],
  downloadType: null,
};

/** The page over a real report choice, as the flow keeps it. */
const Harness: React.FC<{ context: Partial<DataContextValue>; initial: ReportParams }> = ({
  context,
  initial,
}) => {
  const [params, setParams] = useState(initial);
  return (
    <DataContext.Provider
      value={makeDataContext({
        ...context,
        reportGenerationParams: params,
        setReportGenerationParams: setParams,
      })}
    >
      <ReportPageContent />
    </DataContext.Provider>
  );
};

const renderPage = async ({
  farms = [f1, f2],
  maps = [gfw, tmf],
  results = [makeMapResults(1, { F01: 0.05, F02: 0 }), makeMapResults(2, { F01: 0, F02: null })],
  initial = UNSEEDED,
}: {
  farms?: FarmData[];
  maps?: typeof gfw[];
  results?: ReturnType<typeof makeMapResults>[];
  initial?: ReportParams;
} = {}) => {
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <Harness
        initial={initial}
        context={{
          selectedCountry: "CR",
          farmsData: farms,
          territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: maps },
          territorialAnalysisResults: results,
          availableCategories: [deforestation],
        }}
      />
    </I18nextProvider>
  );
};

const farmBox = (name: RegExp) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const selectAll = () => farmBox(/Seleccionar todos/);
const layerBox = (name: RegExp) =>
  within(screen.getByRole("region", { name: "Capas del reporte" })).getByRole("checkbox", {
    name,
  }) as HTMLInputElement;
const previewButton = () =>
  screen.getByRole("button", { name: /vista previa/ }) as HTMLButtonElement;

beforeEach(() => {
  setPathname("/report-generation");
  setParams({ locale: "es" });
  setRuntimeConfig({ deforestationThresholdPercentage: 1, overlapThresholdPercentage: 0 });
  stubObjectUrls();
  vi.mocked(fetchLayerImages).mockResolvedValue([]);
  client.render.mockImplementation(async () => new Blob(["pdf"]));
});

describe("ReportPageContent", () => {
  it("shows the stage, the choices, the actions and the preview panel", async () => {
    await renderPage();

    expect(screen.getByText("Etapa 3 de 3")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reporte" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Polígonos" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Capas del reporte" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generar vista previa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descargar" })).toBeTruthy();
    expect(screen.getByText("Aún no hay vista previa")).toBeTruthy();
  });

  it("ticks every polygon and every analysed layer on the first visit", async () => {
    await renderPage();

    await waitFor(() => expect(selectAll().checked).toBe(true));
    expect(farmBox(/F01 Ana Pérez/).checked).toBe(true);
    expect(farmBox(/F02 Bruno Soto/).checked).toBe(true);
    expect(layerBox(/Global Forest Watch/).checked).toBe(true);
    expect(layerBox(/Tropical Moist Forests/).checked).toBe(true);
  });

  it("keeps the user's choice on the way back, even an empty one", async () => {
    await renderPage({
      initial: { seeded: true, selectedMaps: [gfw], selectedFarms: [], downloadType: null },
    });

    expect(farmBox(/F01/).checked).toBe(false);
    expect(farmBox(/F02/).checked).toBe(false);
    expect(layerBox(/Tropical Moist Forests/).checked).toBe(false);
  });

  it("selects all within the search only", async () => {
    setSearchParams({ search: "Bruno" });
    await renderPage({
      initial: { seeded: true, selectedMaps: [gfw], selectedFarms: [f1, f2], downloadType: null },
    });
    expect(screen.queryByRole("checkbox", { name: /F01/ })).toBeNull();

    fireEvent.click(selectAll());

    expect(farmBox(/F02/).checked).toBe(false);
    setSearchParams({});
    // The farm the search didn't list stays ticked
    expect(
      screen.getByRole("region", { name: "Polígonos" }).querySelector("p")?.textContent
    ).toBe("1 de 2 seleccionados");
  });

  it("offers only the analysed layers", async () => {
    await renderPage({ results: [makeMapResults(1, { F01: 0, F02: 0 })] });

    expect(layerBox(/Global Forest Watch/)).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Capas del reporte" })).queryByRole(
        "checkbox",
        { name: /Tropical Moist Forests/ }
      )
    ).toBeNull();
  });

  it("colours each polygon's category with its worst result, and lists each layer's finding", async () => {
    await renderPage();
    await waitFor(() => expect(selectAll().checked).toBe(true));

    expect(
      screen.getByRole("img", { name: /^Deforestación: Con deforestación\. GFW 5\s?%, TMF Libre/ })
    ).toBeTruthy();
    // F02: ok on GFW and no result on TMF
    expect(
      screen.getByRole("img", { name: /^Deforestación: Sin dato\. GFW Libre de deforestación, TMF Sin dato/ })
    ).toBeTruthy();

    // Without GFW, F01 is ok
    fireEvent.click(layerBox(/Global Forest Watch/));

    expect(
      screen.getByRole("img", { name: "Deforestación: Libre de deforestación. TMF Libre de deforestación" })
    ).toBeTruthy();
  });

  it("turns the preview button off, and says why, without polygons", async () => {
    await renderPage({
      initial: { seeded: true, selectedMaps: [gfw], selectedFarms: [], downloadType: null },
    });

    expect(previewButton().disabled).toBe(true);
    expect(screen.getByText("Elige al menos un polígono.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Descargar" }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });

  it("renders the preview only when asked, and marks it stale after a change", async () => {
    await renderPage();
    await waitFor(() => expect(selectAll().checked).toBe(true));

    expect(sendUsageEvent).not.toHaveBeenCalled();
    expect(client.render).not.toHaveBeenCalled();

    await act(async () => fireEvent.click(previewButton()));

    expect(sendUsageEvent).toHaveBeenCalledWith(
      { type: "report_requested", outcome: "ok", farms: 2 },
      "CR"
    );
    await waitFor(() => expect(screen.getByTitle("Vista previa del reporte")).toBeTruthy());
    expect(previewButton().disabled).toBe(true);
    expect(screen.getByText("La vista previa está al día.")).toBeTruthy();
    const renders = client.render.mock.calls.length;

    fireEvent.click(farmBox(/F01/));

    expect(screen.getByText("La vista previa no refleja los últimos cambios.")).toBeTruthy();
    expect(screen.getByTitle("Vista previa del reporte")).toBeTruthy();
    expect(client.render).toHaveBeenCalledTimes(renders);

    // Back to the previewed choice: the notice goes, and nothing renders again
    fireEvent.click(farmBox(/F01/));

    expect(screen.queryByText("La vista previa no refleja los últimos cambios.")).toBeNull();
    expect(client.render).toHaveBeenCalledTimes(renders);
  });

  it("turns the stale notice's update off, and says why, without polygons or layers", async () => {
    await renderPage();
    await waitFor(() => expect(selectAll().checked).toBe(true));
    await act(async () => fireEvent.click(previewButton()));
    await waitFor(() => expect(screen.getByTitle("Vista previa del reporte")).toBeTruthy());
    vi.mocked(sendUsageEvent).mockClear();

    // Every polygon unticked after the preview
    fireEvent.click(selectAll());

    // The stale notice, and its button, as they are now
    const notice = () =>
      screen.getByText("La vista previa no refleja los últimos cambios.").parentElement!;
    const update = () =>
      within(notice()).getByRole("button", {
        name: "Actualizar vista previa",
      }) as HTMLButtonElement;
    expect(update().disabled).toBe(true);
    expect(within(notice()).getByText("Elige al menos un polígono.")).toBeTruthy();

    // Polygons back, every layer unticked
    fireEvent.click(selectAll());
    fireEvent.click(layerBox(/Global Forest Watch/));
    fireEvent.click(layerBox(/Tropical Moist Forests/));

    expect(update().disabled).toBe(true);
    expect(within(notice()).getByText("Elige al menos una capa.")).toBeTruthy();
    expect(sendUsageEvent).not.toHaveBeenCalled();

    // A layer back: the notice's update asks for the preview, as the sidebar's does
    fireEvent.click(layerBox(/Global Forest Watch/));
    await act(async () => fireEvent.click(update()));

    expect(sendUsageEvent).toHaveBeenCalledWith(
      { type: "report_requested", outcome: "ok", farms: 2 },
      "CR"
    );
  });

  it("puts only the rows in view in the page", async () => {
    const farms = Array.from({ length: 1000 }, (_, i) =>
      makeFarm({ id: `F${String(i).padStart(4, "0")}` })
    );
    // jsdom lays nothing out: a full list frame
    const frame = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(392);
    await renderPage({ farms, results: [makeMapResults(1, { F0000: 0 })], maps: [gfw] });
    frame.mockRestore();

    const rows = within(screen.getByRole("group", { name: "Polígonos" })).getAllByRole(
      "checkbox"
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(100);
  });
});
