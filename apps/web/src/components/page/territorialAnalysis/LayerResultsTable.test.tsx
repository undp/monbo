import { render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext, type DataContextValue } from "@/context/DataContext";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import { createTestI18n, type TestLocale } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { LayerResultsTable } from "./LayerResultsTable";

beforeEach(() => {
  // The global threshold differs from the categories': the cells must not use it.
  setRuntimeConfig({
    deforestationThresholdPercentage: 50,
    overlapThresholdPercentage: 1,
  });
});

const deforestation = makeCategory({ thresholdPercentage: 2 });
const frontier = makeFrontierCategory();
const gfw = makeMap({ id: 1, alias: "GFW" });
const tmf = makeMap({ id: 2, alias: "TMF" });
const upra = makeMap({ id: 5, alias: "UPRA", categoryId: frontier.id });

const renderTable = async (
  context: Partial<DataContextValue>,
  locale: TestLocale = "es"
) => {
  const i18n = await createTestI18n(locale);
  return render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={makeDataContext(context)}>
        <LayerResultsTable />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

describe("LayerResultsTable", () => {
  it("labels and counts the farms with the layer's category", async () => {
    await renderTable({
      farmsData: ["F01", "F02", "F03", "F04", "F05"].map((id) => makeFarm({ id })),
      territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [gfw] },
      territorialAnalysisResults: [
        makeMapResults(1, { F01: 0, F02: 0.005, F03: 0.02, F04: 0.05, F05: null }),
      ],
      availableCategories: [deforestation],
    });

    // 0.005 and 0.02 are at or below the category's threshold: ok, without a %.
    expect(screen.getAllByText("Libre de deforestación")).toHaveLength(3);
    expect(screen.getAllByText("5% · Con deforestación")).toHaveLength(1);
    expect(screen.getAllByText("Sin dato")).toHaveLength(1);
    // The footer counter agrees with the cells.
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("groups the layer columns under their category", async () => {
    await renderTable({
      farmsData: [makeFarm({ id: "F01" })],
      territorialAnalysisParams: {
        polygonsSubset: "all",
        selectedMaps: [gfw, tmf, upra],
      },
      territorialAnalysisResults: [
        makeMapResults(5, { F01: 1 }),
        makeMapResults(1, { F01: 0 }),
        makeMapResults(2, { F01: 0 }),
      ],
      availableCategories: [deforestation, frontier],
    });

    const [groupRow, headerRow] = screen.getAllByRole("row");
    const groupCells = within(groupRow).getAllByRole("columnheader");
    expect(groupCells.map((cell) => cell.textContent)).toEqual([
      "",
      "Deforestación",
      "Frontera agrícola",
    ]);
    expect(groupCells.map((cell) => cell.getAttribute("colspan"))).toEqual([
      "4",
      "2",
      "1",
    ]);
    // Layer columns follow the categories' order, then the layer ids.
    expect(
      within(headerRow)
        .getAllByRole("columnheader")
        .slice(4)
        .map((cell) => cell.textContent)
    ).toEqual(["GFW", "TMF", "UPRA"]);
  });

  it("shows the finding of a required category", async () => {
    await renderTable({
      farmsData: [makeFarm({ id: "F01" }), makeFarm({ id: "F02" })],
      territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [upra] },
      territorialAnalysisResults: [makeMapResults(5, { F01: 0.82, F02: 0.96 })],
      availableCategories: [frontier],
    });

    expect(screen.getByText("18% · Fuera de la frontera agrícola")).toBeTruthy();
    expect(screen.getByText("Dentro de la frontera agrícola")).toBeTruthy();
  });

  it("reads a layer whose category is missing as no data", async () => {
    await renderTable({
      farmsData: [makeFarm({ id: "F01" })],
      territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [upra] },
      territorialAnalysisResults: [makeMapResults(5, { F01: 0 })],
      availableCategories: [deforestation],
    });

    expect(screen.getByText("Sin categoría")).toBeTruthy();
    // The cell and the footer counter both say "Sin dato".
    expect(screen.getAllByText("Sin dato")).toHaveLength(2);
    expect(screen.queryByText("Dentro de la frontera agrícola")).toBeNull();
  });

  it("uses the category's English texts", async () => {
    await renderTable(
      {
        farmsData: [makeFarm({ id: "F01" })],
        territorialAnalysisParams: { polygonsSubset: "all", selectedMaps: [upra] },
        territorialAnalysisResults: [makeMapResults(5, { F01: 0.82 })],
        availableCategories: [frontier],
      },
      "en"
    );

    expect(screen.getByText("Agricultural frontier")).toBeTruthy();
    expect(screen.getByText("18% · Outside the agricultural frontier")).toBeTruthy();
  });
});
