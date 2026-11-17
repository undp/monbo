import { render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { DataContext } from "@/context/DataContext";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { CategorySummaryCards } from "./CategorySummaryCards";

const frontier = makeFrontierCategory();

describe("CategorySummaryCards", () => {
  it("summarises each category from all its layers", async () => {
    const i18n = await createTestI18n("es");
    render(
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider
          value={makeDataContext({
            farmsData: ["A", "B", "C"].map((id) => makeFarm({ id })),
            deforestationAnalysisParams: {
              polygonsSubset: "all",
              selectedMaps: [
                makeMap({ id: 1 }),
                makeMap({ id: 2 }),
                makeMap({ id: 5, categoryId: frontier.id }),
              ],
            },
            deforestationAnalysisResults: [
              makeMapResults(1, { A: 0, B: 0, C: 0 }),
              makeMapResults(2, { A: 0, B: 0.3, C: null }),
              makeMapResults(5, { A: 1, B: 0.82, C: 0.96 }),
            ],
            availableCategories: [makeCategory({ thresholdPercentage: 2 }), frontier],
          })}
        >
          <CategorySummaryCards />
        </DataContext.Provider>
      </I18nextProvider>
    );

    const deforestation = screen.getByRole("listitem", { name: "Deforestación" });
    expect(within(deforestation).getByText("2 capas")).toBeTruthy();
    expect(within(deforestation).getByText("1 de 3")).toBeTruthy();
    expect(within(deforestation).getByText("Libre de deforestación")).toBeTruthy();
    expect(
      within(deforestation).getByText("1 con observaciones · 1 sin dato")
    ).toBeTruthy();

    // 18 % of B is outside the frontier: it has findings in that category.
    const frontierCard = screen.getByRole("listitem", { name: "Frontera agrícola" });
    expect(within(frontierCard).getByText("1 capa")).toBeTruthy();
    expect(within(frontierCard).getByText("2 de 3")).toBeTruthy();
    expect(
      within(frontierCard).getByText("1 con observaciones · 0 sin dato")
    ).toBeTruthy();
  });
});
