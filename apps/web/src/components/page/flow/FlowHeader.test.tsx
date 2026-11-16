import { fireEvent, render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import {
  makeFarm,
  makeMap,
  makeMapResults,
  makeValidationResults,
} from "@/test/factories";
import { router, setPathname } from "@/test/navigation";
import { FlowHeader } from "./FlowHeader";

const ANALYZED: Partial<DataContextValue> = {
  deforestationAnalysisResults: [makeMapResults(1, { "farm-1": 0 })],
};

const renderHeader = async (
  pathname: string,
  overrides: Partial<DataContextValue> = {},
  locale: TestLocale = "es"
) => {
  setPathname(pathname);
  const i18n = await createTestI18n(locale);
  render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={makeDataContext({ selectedCountry: "CO", ...overrides })}>
        <FlowHeader />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

const stepper = () => screen.getByRole("navigation", { name: "Etapas del análisis" });
/** The visible text of each stage, in order. */
const stageTexts = () =>
  within(stepper())
    .getAllByRole("listitem")
    .map((item) => item.textContent)
    .filter(Boolean);

describe("FlowHeader", () => {
  it("names the country and links to the landing page to change it", async () => {
    await renderHeader("/polygons-validation/upload-data");

    expect(screen.getByText("Colombia")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cambiar país" }).getAttribute("href")).toBe("/");
    expect(
      screen.getByText("Gratis · tus polígonos no se guardan en nuestros servidores")
    ).toBeTruthy();
  });

  it("normal entry: here, go straight to stage 2, stage 3 waits", async () => {
    await renderHeader("/polygons-validation/upload-data");

    expect(stageTexts()).toEqual([
      "1ValidaciónEstás aquí",
      "2Análisis territorialPuedes ir directo",
      "3ReporteCon los resultados de la etapa 2",
    ]);
    expect(
      screen.getByRole("button", { name: /Validación/ }).getAttribute("aria-current")
    ).toBe("step");
  });

  it("direct entry to stage 2: stage 1 is optional and stage 3 can't be pressed", async () => {
    await renderHeader("/deforestation-analysis/upload-data");

    expect(stageTexts()[0]).toBe("1ValidaciónSin realizar · opcional");
    expect(screen.queryByRole("button", { name: /Reporte/ })).toBeNull();
    expect(screen.getByText("Con los resultados de la etapa 2")).toBeTruthy();
  });

  it("stage 1 is completed once the polygons are validated", async () => {
    await renderHeader("/deforestation-analysis/upload-data", {
      polygonsValidationResults: makeValidationResults({}),
    });

    expect(stageTexts()[0]).toBe("ValidaciónCompletada");
  });

  it("opens a stage's upload page, or its results when it has them", async () => {
    await renderHeader("/polygons-validation/upload-data");

    fireEvent.click(screen.getByRole("button", { name: /Análisis territorial/ }));
    expect(router.push).toHaveBeenLastCalledWith("/deforestation-analysis/upload-data");
  });

  it("opens the validation results from another stage", async () => {
    await renderHeader("/deforestation-analysis", {
      ...ANALYZED,
      polygonsValidationResults: makeValidationResults({}),
    });

    fireEvent.click(screen.getByRole("button", { name: /Validación/ }));
    expect(router.push).toHaveBeenLastCalledWith("/polygons-validation");
  });

  it("after a validation, opens the analysis modal instead of skipping it", async () => {
    await renderHeader("/polygons-validation", {
      polygonsValidationResults: makeValidationResults({}),
    });

    fireEvent.click(screen.getByRole("button", { name: /Análisis territorial/ }));

    expect(router.push).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Selecciona los polígonos a considerar")).toBeTruthy();
  });

  it("keeps the language prefix", async () => {
    await renderHeader("/en/polygons-validation/upload-data", {}, "en");

    fireEvent.click(screen.getByRole("button", { name: /Territorial analysis/ }));
    expect(router.push).toHaveBeenCalledWith("/en/deforestation-analysis/upload-data");
  });

  it("asks for the report's layers before opening stage 3", async () => {
    await renderHeader("/deforestation-analysis", ANALYZED);

    fireEvent.click(screen.getByRole("button", { name: /Reporte/ }));

    expect(router.push).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("asks again when the report has layers but no confirmed farms", async () => {
    const map = makeMap();
    await renderHeader("/deforestation-analysis", {
      ...ANALYZED,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [map] },
      reportGenerationParams: {
        initialFarmSelection: "all",
        selectedMaps: [map],
        selectedFarms: [],
        downloadType: null,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Reporte/ }));

    expect(router.push).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog")).toBeTruthy();
  });

  it("opens stage 3 directly once the report's choices are ready", async () => {
    const map = makeMap();
    await renderHeader("/polygons-validation", {
      ...ANALYZED,
      deforestationAnalysisParams: { polygonsSubset: "valid", selectedMaps: [map] },
      reportGenerationParams: {
        initialFarmSelection: "all",
        selectedMaps: [map],
        selectedFarms: [makeFarm()],
        downloadType: null,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Reporte/ }));
    expect(router.push).toHaveBeenCalledWith("/report-generation");
  });
});
