import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { generateFarmsData } from "@/api/farms";
import { analyzeLayers } from "@/api/layerAnalysis";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { router, setPathname } from "@/test/navigation";
import { makeFarm, makeMapResults, makeValidationResults } from "@/test/factories";
import { TerritorialAnalysisUploadDataPageContent } from "./TerritorialAnalysisUploadDataPageContent";

vi.mock("@/api/farms", () => ({ generateFarmsData: vi.fn() }));
vi.mock("@/api/layerAnalysis", () => ({ analyzeLayers: vi.fn() }));
// The upload step itself is covered elsewhere: here it only hands rows over.
vi.mock("@/components/page/uploadData/FarmsUploadStep", () => ({
  FarmsUploadStep: ({
    onSubmit,
    submitLabel,
    keepBar,
  }: {
    onSubmit: (rows: unknown[]) => void;
    submitLabel: string;
    keepBar?: boolean;
  }) => (
    <button data-keep-bar={keepBar} onClick={() => onSubmit([{ id: "new-1" }])}>
      {submitLabel}
    </button>
  ),
}));

const renderPage = async (overrides: Partial<DataContextValue>) => {
  const context = makeDataContext({ selectedCountry: "CO", ...overrides });
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

const pressContinue = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  });

describe("TerritorialAnalysisUploadDataPageContent", () => {
  it("uploads first on a direct entry, under stage 2's title", async () => {
    setPathname("/territorial-analysis/upload-data");
    await renderPage({ farmsData: null });

    expect(screen.getByRole("heading", { name: "Análisis territorial" })).toBeTruthy();
    expect(screen.getByText("Etapa 2 de 3")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
  });

  it("parses the list and goes to the layers, without analysing", async () => {
    const parsed = [makeFarm({ id: "new-1" })];
    vi.mocked(generateFarmsData).mockResolvedValue(parsed);
    const context = await renderPage({ farmsData: null, uploadSourcesRevision: 4 });

    await pressContinue();

    await waitFor(() => expect(context.setFarmsData).toHaveBeenCalled());
    expect(context.setFarmsSourcesRevision).toHaveBeenCalledWith(4);
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis/layers");
    expect(analyzeLayers).not.toHaveBeenCalled();
  });

  it("drops the results of the earlier farms when the list changed", async () => {
    vi.mocked(generateFarmsData).mockResolvedValue([makeFarm({ id: "new-1" })]);
    const context = await renderPage({
      farmsData: [makeFarm({ id: "old" })],
      // The farms were parsed from an earlier version of the list
      farmsSourcesRevision: 2,
      uploadSourcesRevision: 3,
      polygonsValidationResults: makeValidationResults({}),
      territorialAnalysisResults: [makeMapResults(1, { old: 0 })],
    });

    await pressContinue();

    await waitFor(() => expect(context.setFarmsData).toHaveBeenCalled());
    expect(context.setPolygonsValidationResults).toHaveBeenCalledWith(null);
    expect(context.setTerritorialAnalysisResults).toHaveBeenCalledWith(null);
    expect(context.setAnalysisOutdated).toHaveBeenCalledWith(false);
    expect(context.setReportGenerationParams).toHaveBeenCalledWith(
      expect.objectContaining({ seeded: false, selectedFarms: [] })
    );
    // The layers and the subset chosen stay
    expect(context.setAnalysisDraft).not.toHaveBeenCalled();
  });

  it("keeps the farms and their results when the list didn't change", async () => {
    const context = await renderPage({
      farmsData: [makeFarm({ id: "old" })],
      farmsSourcesRevision: 3,
      uploadSourcesRevision: 3,
      polygonsValidationResults: makeValidationResults({}),
      territorialAnalysisResults: [makeMapResults(1, { old: 0 })],
    });

    await pressContinue();

    expect(generateFarmsData).not.toHaveBeenCalled();
    expect(context.setFarmsData).not.toHaveBeenCalled();
    expect(context.setPolygonsValidationResults).not.toHaveBeenCalled();
    expect(context.setTerritorialAnalysisResults).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/territorial-analysis/layers");
  });

  it("stays on the list when the parser rejects it", async () => {
    vi.mocked(generateFarmsData).mockRejectedValue(new Error("bad file"));
    const context = await renderPage({ farmsData: null });

    await pressContinue();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy()
    );
    expect(context.setFarmsData).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps the bar on an emptied list while farms are loaded from it", async () => {
    await renderPage({ farmsData: [makeFarm({ id: "old" })] });
    expect(
      screen.getByRole("button", { name: "Continuar" }).getAttribute("data-keep-bar")
    ).toBe("true");

    cleanup();
    await renderPage({ farmsData: null });
    expect(
      screen.getByRole("button", { name: "Continuar" }).getAttribute("data-keep-bar")
    ).toBe("false");
  });
});
