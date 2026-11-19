import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { generateFarmsData } from "@/api/farms";
import { analyzeLayers } from "@/api/layerAnalysis";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { router } from "@/test/navigation";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
  makeValidationResults,
} from "@/test/factories";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { TerritorialAnalysisUploadDataPageContent } from "./TerritorialAnalysisUploadDataPageContent";

vi.mock("@/api/farms", () => ({ generateFarmsData: vi.fn() }));
vi.mock("@/api/layerAnalysis", () => ({ analyzeLayers: vi.fn() }));
// The upload step itself is covered elsewhere: here it only hands rows over.
vi.mock("@/components/page/uploadData/FarmsUploadStep", () => ({
  FarmsUploadStep: ({ onSubmit }: { onSubmit: (rows: unknown[]) => void }) => (
    <button onClick={() => onSubmit([{ id: "new-1" }])}>upload</button>
  ),
}));

const frontier = makeFrontierCategory();
const gfw = makeMap({ id: 1, name: "Global Forest Watch", alias: "GFW", availableCountriesCodes: ["CO"] });
const tmf = makeMap({ id: 2, name: "Tropical Moist Forests", alias: "TMF", availableCountriesCodes: ["CO"] });
const upra = makeMap({
  id: 5,
  name: "Frontera agrícola nacional",
  alias: "UPRA",
  categoryId: frontier.id,
  baseline: null,
  comparedAgainst: null,
  availableCountriesCodes: ["CO"],
});
const categories = [makeCategory(), frontier];
const farms = ["F01", "F02", "F03"].map((id) => makeFarm({ id }));
const validation = makeValidationResults({
  F01: FarmValidationStatus.VALID,
  F02: FarmValidationStatus.VALID,
  F03: FarmValidationStatus.NOT_VALID,
});

const renderPage = async (overrides: Partial<DataContextValue>) => {
  const context = makeDataContext({
    selectedCountry: "CO",
    availableMaps: [gfw, tmf, upra],
    availableCategories: categories,
    ...overrides,
  });
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={context}>
        <TerritorialAnalysisUploadDataPageContent />
      </DataContext.Provider>
    </I18nextProvider>
  );
  return context;
};

/** Lets pending effects and promises settle. */
const settle = () => act(async () => {});

describe("TerritorialAnalysisUploadDataPageContent", () => {
  it("groups the country's layers by category", async () => {
    await renderPage({
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    const deforestation = screen.getByRole("group", { name: "Deforestación" });
    expect(within(deforestation).getByText("1 de 2 capas")).toBeTruthy();
    expect(
      within(deforestation).getByRole("checkbox", { name: /Global Forest Watch/ })
    ).toHaveProperty("checked", true);
    expect(
      within(deforestation).getByRole("checkbox", { name: /Tropical Moist Forests/ })
    ).toHaveProperty("checked", false);

    const frontierGroup = screen.getByRole("group", { name: "Frontera agrícola" });
    expect(within(frontierGroup).getByText("0 de 1 capa")).toBeTruthy();
    expect(
      within(frontierGroup).getByText("Zonas donde se permite la producción agropecuaria.")
    ).toBeTruthy();
  });

  it("adds a ticked layer to the draft, without starting the analysis", async () => {
    const context = await renderPage({
      farmsData: farms,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /Frontera agrícola nacional/ }));
    expect(context.setAnalysisDraft).toHaveBeenLastCalledWith({
      polygonsSubset: "valid",
      selectedMapIds: [1, 5],
    });
    expect(screen.getByText("3 polígonos · 2 capas en 2 categorías")).toBeTruthy();
    await settle();
    expect(analyzeLayers).not.toHaveBeenCalled();
    // The analysed choices only change when an analysis succeeds.
    expect(context.setTerritorialAnalysisParams).not.toHaveBeenCalled();
  });

  it("opens with the stored draft", async () => {
    await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
      analysisDraft: { polygonsSubset: "all", selectedMapIds: [5] },
    });

    expect(
      screen.getByRole("checkbox", { name: /Frontera agrícola nacional/ })
    ).toHaveProperty("checked", true);
    expect(screen.getByRole("checkbox", { name: /Global Forest Watch/ })).toHaveProperty(
      "checked",
      false
    );
    expect(screen.getByRole("radio", { name: "Todos (3)" })).toHaveProperty(
      "checked",
      true
    );
  });

  it("leaves the analysed results alone when the choices change without Analizar", async () => {
    // The review's case: 2 valid polygons analysed with GFW and TMF. On the page,
    // TMF is unticked and "all" picked, then the user goes back without analysing.
    const context = await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      territorialAnalysisParams: {
        polygonsSubset: "valid",
        selectedMaps: [gfw, tmf],
      },
      territorialAnalysisResults: [
        makeMapResults(1, { F01: 0, F02: 0, F03: 0 }),
        makeMapResults(2, { F01: 0, F02: 0, F03: 0 }),
      ],
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /Tropical Moist Forests/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Todos (3)" }));
    cleanup();
    await settle();

    // What the results page and the report read is untouched: the invalid
    // polygon stays hidden and TMF stays analysed.
    expect(context.setTerritorialAnalysisParams).not.toHaveBeenCalled();
    expect(context.setTerritorialAnalysisResults).not.toHaveBeenCalled();
    expect(analyzeLayers).not.toHaveBeenCalled();
    expect(context.setAnalysisDraft).toHaveBeenLastCalledWith({
      polygonsSubset: "all",
      selectedMapIds: [1],
    });
  });

  it("never sends a layer hidden since the analysis", async () => {
    vi.mocked(analyzeLayers).mockResolvedValue([makeMapResults(1, { F01: 0 })]);
    sessionStorage.setItem("monbo.selectedCountry", "CO");
    // TMF was analysed, then its category was disabled: GET /maps no longer lists
    // it, but the analysed params keep it while results refer to it.
    const context = await renderPage({
      availableMaps: [gfw, upra],
      farmsData: farms,
      territorialAnalysisParams: {
        polygonsSubset: "all",
        selectedMaps: [gfw, tmf],
      },
      territorialAnalysisResults: [
        makeMapResults(1, { F01: 0 }),
        makeMapResults(2, { F01: 0 }),
      ],
    });

    // Neither counted nor shown.
    expect(screen.getByText("3 polígonos · 1 capa en 1 categoría")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Tropical Moist Forests/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Analizar" }));

    await waitFor(() => expect(analyzeLayers).toHaveBeenCalledWith(farms, [gfw], "CO"));
    await waitFor(() =>
      expect(context.setTerritorialAnalysisParams).toHaveBeenCalledWith({
        polygonsSubset: "all",
        selectedMaps: [gfw],
      })
    );
  });

  it("doesn't analyse on opening after a validation (back button), and asks for the subset", async () => {
    // Layers ticked on stage 2, then farms validated on stage 1, then back twice.
    await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });
    await settle();

    expect(analyzeLayers).not.toHaveBeenCalled();
    expect(screen.getByText("Usarás 2 polígonos de la validación.")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Solo los válidos (2)" })).toHaveProperty(
      "checked",
      true
    );
    expect(screen.getByRole("radio", { name: "Todos (3)" })).toHaveProperty(
      "checked",
      false
    );
  });

  it("analyses the draft when the user presses Analizar, and only then stores it", async () => {
    vi.mocked(analyzeLayers).mockResolvedValue([makeMapResults(1, { F01: 0 })]);
    const context = await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    // The request checks the stored country before keeping its results.
    sessionStorage.setItem("monbo.selectedCountry", "CO");
    fireEvent.click(screen.getByRole("button", { name: "Analizar" }));

    await waitFor(() => expect(analyzeLayers).toHaveBeenCalledWith(farms, [gfw], "CO"));
    await waitFor(() =>
      expect(context.setTerritorialAnalysisResults).toHaveBeenCalled()
    );
    // The results and the choices they were analysed with change together.
    expect(context.setTerritorialAnalysisParams).toHaveBeenCalledWith({
      polygonsSubset: "valid",
      selectedMaps: [gfw],
    });
    expect(context.setAnalysisDraft).toHaveBeenCalledWith(null);
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis");
  });

  it("stores the subset the user picks", async () => {
    const context = await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    fireEvent.click(screen.getByRole("radio", { name: "Todos (3)" }));
    expect(context.setAnalysisDraft).toHaveBeenLastCalledWith({
      polygonsSubset: "all",
      selectedMapIds: [1],
    });
    expect(screen.getByText("Usarás 3 polígonos de la validación.")).toBeTruthy();
    expect(context.setTerritorialAnalysisParams).not.toHaveBeenCalled();
  });

  it("recalculates an outdated analysis on opening", async () => {
    vi.mocked(analyzeLayers).mockResolvedValue([makeMapResults(1, { F01: 0 })]);
    await renderPage({
      farmsData: farms,
      analysisOutdated: true,
      territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw] },
    });

    await waitFor(() => expect(analyzeLayers).toHaveBeenCalledTimes(1));
  });

  it("keeps a pending draft through a recalculation", async () => {
    vi.mocked(analyzeLayers).mockResolvedValue([makeMapResults(1, { F01: 0 })]);
    sessionStorage.setItem("monbo.selectedCountry", "CO");
    // GFW was analysed; on the page the user had picked TMF instead without
    // analysing; then GFW changed and the results were invalidated.
    const context = await renderPage({
      farmsData: farms,
      analysisOutdated: true,
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
      analysisDraft: { polygonsSubset: "all", selectedMapIds: [2] },
    });

    // The recalculation re-runs what was analysed, not the draft...
    await waitFor(() => expect(analyzeLayers).toHaveBeenCalledWith(farms, [gfw], "CO"));
    await waitFor(() =>
      expect(context.setTerritorialAnalysisParams).toHaveBeenCalledWith({
        polygonsSubset: "valid",
        selectedMaps: [gfw],
      })
    );
    // ...and leaves the draft for the next visit to the page.
    expect(context.setAnalysisDraft).not.toHaveBeenCalled();
  });

  it("guides a direct entry without polygons, without blocking it", async () => {
    await renderPage({
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [] },
    });

    expect(screen.getByText(/Llegaste directo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analizar" })).toHaveProperty(
      "disabled",
      true
    );
    // The layers and the upload step are there.
    expect(screen.getByRole("checkbox", { name: /Global Forest Watch/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "upload" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Ir a validación" }));
    expect(router.push).toHaveBeenCalledWith("/polygons-validation/upload-data");
  });

  it("drops the validation of earlier farms when new ones are uploaded", async () => {
    vi.mocked(generateFarmsData).mockResolvedValue([makeFarm({ id: "new-1" })]);
    const context = await renderPage({
      // The stage 1 validation of another file, with no analysis yet.
      polygonsValidationResults: makeValidationResults({}),
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    fireEvent.click(screen.getByRole("button", { name: "upload" }));

    await waitFor(() => expect(context.setFarmsData).toHaveBeenCalled());
    expect(context.setPolygonsValidationResults).toHaveBeenCalledWith(null);
  });
});
