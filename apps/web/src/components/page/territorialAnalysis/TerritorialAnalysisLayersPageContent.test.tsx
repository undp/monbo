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
import { TerritorialAnalysisLayersPageContent } from "./TerritorialAnalysisLayersPageContent";

vi.mock("@/api/layerAnalysis", () => ({ analyzeLayers: vi.fn() }));

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
    farmsData: farms,
    ...overrides,
  });
  const i18n = await createTestI18n("es");
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={context}>
        <TerritorialAnalysisLayersPageContent />
      </DataContext.Provider>
    </I18nextProvider>
  );
  return context;
};

/** Lets pending effects and promises settle. */
const settle = () => act(async () => {});

/** The bottom bar's counts, as read: "3 polígonos · 2 capas en 2 categorías". */
const summary = () =>
  screen
    .getByRole("button", { name: "Analizar" })
    .closest("div")!
    .parentElement!.textContent!.replace("Analizar", "")
    .replace(/(\d)([a-zá])/g, "$1 $2")
    .replace(/s(\d)/g, "s · $1");

const isChosen = (name: string) =>
  screen.getByRole("radio", { name }).getAttribute("aria-checked") === "true";

describe("TerritorialAnalysisLayersPageContent", () => {
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
    expect(summary()).toBe("3 polígonos · 2 capas en 2 categorías");
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
    expect(isChosen("Todos (3)")).toBe(true);
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
    expect(summary()).toBe("3 polígonos · 1 capa en 1 categoría");
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
    expect(isChosen("Solo los válidos (2)")).toBe(true);
    expect(isChosen("Todos (3)")).toBe(false);
    // The polygon the valid subset leaves out is named
    expect(screen.getByText("F03 queda fuera porque no pasó la validación.")).toBeTruthy();
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

  it("sends the user to the upload when no polygons are loaded", async () => {
    await renderPage({ farmsData: null });

    expect(router.replace).toHaveBeenCalledWith("/territorial-analysis/upload-data");
    expect(screen.queryByRole("button", { name: "Analizar" })).toBeNull();
  });

  it("only informs which polygons it will use without a validation", async () => {
    await renderPage({
      territorialAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    expect(
      screen.getByText("Usarás 3 polígonos. No pasaron por la validación.")
    ).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(summary()).toBe("3 polígonos · 1 capa en 1 categoría");
  });

  it("shows the polygons where they were uploaded, or their validation", async () => {
    await renderPage({});
    fireEvent.click(screen.getByRole("button", { name: "Ver polígonos" }));
    expect(router.push).toHaveBeenLastCalledWith("/territorial-analysis/upload-data");

    cleanup();
    await renderPage({ polygonsValidationResults: validation });
    fireEvent.click(screen.getByRole("button", { name: "Ver polígonos" }));
    expect(router.push).toHaveBeenLastCalledWith("/polygons-validation");
  });

  it("names three left-out polygons, then counts the rest", async () => {
    const many = ["A/1", "A2", "A3", "A4", "A5", "OK"].map((id) => makeFarm({ id }));
    await renderPage({
      farmsData: many,
      polygonsValidationResults: makeValidationResults({
        "A/1": FarmValidationStatus.NOT_VALID,
        A2: FarmValidationStatus.NOT_VALID,
        A3: FarmValidationStatus.NOT_VALID,
        A4: FarmValidationStatus.NOT_VALID,
        A5: FarmValidationStatus.NOT_VALID,
        OK: FarmValidationStatus.VALID,
      }),
    });

    expect(
      // Shown as text: an ID's "/" isn't escaped
      screen.getByText("A/1, A2, A3 y 2 más quedan fuera porque no pasaron la validación.")
    ).toBeTruthy();

    // With every polygon, none is left out
    fireEvent.click(screen.getByRole("radio", { name: "Todos (6)" }));
    expect(screen.queryByText(/quedan fuera/)).toBeNull();
  });

  it("moves the subset choice with the arrow keys", async () => {
    const context = await renderPage({ polygonsValidationResults: validation });

    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });

    expect(isChosen("Todos (3)")).toBe(true);
    expect(context.setAnalysisDraft).toHaveBeenLastCalledWith({
      polygonsSubset: "all",
      selectedMapIds: [],
    });
  });

  it("leaves the form usable when an outdated analysis had no layer left to recalculate", async () => {
    // TMF was analysed, then changed, then hidden: nothing to recalculate.
    await renderPage({
      availableMaps: [gfw, upra],
      analysisOutdated: true,
      territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [tmf] },
    });
    expect(screen.getByRole("button", { name: "Analizar" })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Global Forest Watch/ }));
    await settle();

    // Still the form, not a "recalculating" screen with no request behind it
    expect(screen.getByRole("button", { name: "Analizar" })).toHaveProperty("disabled", false);
    expect(analyzeLayers).not.toHaveBeenCalled();
  });
});
