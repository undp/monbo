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
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { DeforestationResultsTable } from "./DeforestationResultsTable";

beforeEach(() => {
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
// Its category was disabled after the analysis
const runap = makeMap({ id: 9, alias: "RUNAP", categoryId: "protected_areas" });
const farms = [makeFarm({ id: "F01" }), makeFarm({ id: "F02" })];

const renderTable = async (context: Partial<DataContextValue>) => {
  const i18n = await createTestI18n("es");
  return render(
    <I18nextProvider i18n={i18n}>
      <DataContext.Provider value={makeDataContext(context)}>
        <DeforestationResultsTable />
      </DataContext.Provider>
    </I18nextProvider>
  );
};

/** Stage 3: the analysis of 4 layers, and a report with 3 of them. */
const reportStage = (reportMaps = [gfw, upra, runap]): Partial<DataContextValue> => ({
  farmsData: farms,
  deforestationAnalysisParams: {
    polygonsSubset: "all",
    selectedMaps: [gfw, tmf, upra, runap],
  },
  deforestationAnalysisResults: [
    makeMapResults(1, { F01: 0.05, F02: 0 }),
    makeMapResults(2, { F01: 0, F02: 0 }),
    makeMapResults(5, { F01: 0.82, F02: 1 }),
    makeMapResults(9, { F01: 0.5, F02: 0 }),
  ],
  availableCategories: [deforestation, frontier],
  reportGenerationParams: {
    initialFarmSelection: "all",
    selectedMaps: reportMaps,
    selectedFarms: farms,
    downloadType: null,
  },
});

describe("the report stage's results table", () => {
  it("shows only the report's layers, grouped by category", async () => {
    await renderTable(reportStage());

    const [groupRow, headerRow] = screen.getAllByRole("row");
    expect(
      within(groupRow)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent)
      // The selection checkbox's column, then the farm columns
    ).toEqual(["", "", "Deforestación", "Frontera agrícola", "Sin categoría"]);
    const headers = within(headerRow)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual(expect.arrayContaining(["GFW", "UPRA", "RUNAP"]));
    expect(headers).not.toContain("TMF");
  });

  it("reads each layer with its category, and No data without one", async () => {
    await renderTable(reportStage());

    expect(screen.getByText("5% · Con deforestación")).toBeTruthy();
    expect(screen.getByText("18% · Fuera de la frontera agrícola")).toBeTruthy();
    expect(screen.getByText("Dentro de la frontera agrícola")).toBeTruthy();
    // RUNAP's category is gone: never classified with another rule
    const farmRows = screen
      .getAllByRole("row")
      .filter((row) => /F0[12]/.test(row.textContent ?? ""));
    expect(farmRows).toHaveLength(2);
    for (const row of farmRows)
      expect(within(row).getByText("Sin dato")).toBeTruthy();
  });

  it("puts each layer's counter under its own column", async () => {
    await renderTable(reportStage());

    const [, headerRow] = screen.getAllByRole("row");
    const footerRow = screen.getAllByRole("row").at(-1)!;
    const headers = within(headerRow).getAllByRole("columnheader");
    const footers = within(footerRow).getAllByRole("cell");
    expect(footers).toHaveLength(headers.length);
    const column = (name: string) =>
      headers.findIndex((cell) => cell.textContent === name);
    // GFW: 1 farm without findings; UPRA: 1 inside the frontier
    expect(footers[column("GFW")].textContent).toBe("1");
    expect(footers[column("UPRA")].textContent).toBe("1");
    expect(footers[column("Tipo de cultivo")].textContent).toBe("");
  });

  it("selects every farm of the report", async () => {
    await renderTable(reportStage());
    const checkboxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(checkboxes.every((checkbox) => checkbox.checked)).toBe(true);
  });
});
