import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { DeforestationAnalysisUploadDataPageContent } from "./DeforestationAnalysisUploadDataPageContent";

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
        <DeforestationAnalysisUploadDataPageContent />
      </DataContext.Provider>
    </I18nextProvider>
  );
  return context;
};

/** Lets pending effects and promises settle. */
const settle = () => act(async () => {});

describe("DeforestationAnalysisUploadDataPageContent", () => {
  it("groups the country's layers by category", async () => {
    await renderPage({
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
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

  it("adds a ticked layer without starting the analysis", async () => {
    const context = await renderPage({
      farmsData: farms,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    fireEvent.click(screen.getByRole("checkbox", { name: /Frontera agrícola nacional/ }));
    const update = vi.mocked(context.setDeforestationAnalysisParams).mock.calls[0][0];
    expect(
      typeof update === "function" &&
        update({ polygonsSubset: "valid", selectedMaps: [gfw] }).selectedMaps
    ).toEqual([gfw, upra]);
    await settle();
    expect(analyzeLayers).not.toHaveBeenCalled();
  });

  it("doesn't analyse on opening after a validation (back button), and asks for the subset", async () => {
    // Layers ticked on stage 2, then farms validated on stage 1, then back twice.
    await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
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

  it("analyses when the user presses Analizar", async () => {
    vi.mocked(analyzeLayers).mockResolvedValue([makeMapResults(1, { F01: 0 })]);
    const context = await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    // The request checks the stored country before keeping its results.
    sessionStorage.setItem("monbo.selectedCountry", "CO");
    fireEvent.click(screen.getByRole("button", { name: "Analizar" }));

    await waitFor(() => expect(analyzeLayers).toHaveBeenCalledWith(farms, [gfw], "CO"));
    await waitFor(() =>
      expect(context.setDeforestationAnalysisResults).toHaveBeenCalled()
    );
    expect(router.push).toHaveBeenCalledWith("/es/deforestation-analysis");
  });

  it("stores the subset the user picks", async () => {
    const context = await renderPage({
      farmsData: farms,
      polygonsValidationResults: validation,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    fireEvent.click(screen.getByRole("radio", { name: "Todos (3)" }));
    const update = vi.mocked(context.setDeforestationAnalysisParams).mock.calls[0][0];
    expect(
      typeof update === "function" &&
        update({ polygonsSubset: "valid", selectedMaps: [gfw] }).polygonsSubset
    ).toBe("all");
  });

  it("recalculates an outdated analysis on opening", async () => {
    vi.mocked(analyzeLayers).mockResolvedValue([makeMapResults(1, { F01: 0 })]);
    await renderPage({
      farmsData: farms,
      analysisOutdated: true,
      deforestationAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw] },
    });

    await waitFor(() => expect(analyzeLayers).toHaveBeenCalledTimes(1));
  });

  it("guides a direct entry without polygons, without blocking it", async () => {
    await renderPage({
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [] },
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
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [gfw] },
    });

    fireEvent.click(screen.getByRole("button", { name: "upload" }));

    await waitFor(() => expect(context.setFarmsData).toHaveBeenCalled());
    expect(context.setPolygonsValidationResults).toHaveBeenCalledWith(null);
  });
});
