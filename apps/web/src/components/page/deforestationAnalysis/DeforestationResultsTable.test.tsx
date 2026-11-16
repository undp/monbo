import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it } from "vitest";
import { setRuntimeConfig } from "@/config/runtime";
import { DataContext } from "@/context/DataContext";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { createTestI18n } from "@/test/i18n";
import { makeDataContext } from "@/test/renderWithData";
import { DeforestationResultsTable } from "./DeforestationResultsTable";

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
});

describe("DeforestationResultsTable", () => {
  it("labels and counts the farms with the shared classification", async () => {
    const i18n = await createTestI18n("es");
    render(
      <I18nextProvider i18n={i18n}>
        <DataContext.Provider
          value={makeDataContext({
            farmsData: ["F01", "F02", "F03", "F04", "F05"].map((id) =>
              makeFarm({ id })
            ),
            deforestationAnalysisParams: {
              polygonsSubset: "all",
              selectedMaps: [makeMap({ id: 1 })],
            },
            deforestationAnalysisResults: [
              makeMapResults(1, {
                F01: 0,
                F02: 0.005,
                F03: 0.02,
                F04: 0.05,
                F05: null,
              }),
            ],
          })}
        >
          <DeforestationResultsTable />
        </DataContext.Provider>
      </I18nextProvider>
    );

    // 0.005 and 0.02 are at or below the threshold: free, not "< 2% Def.".
    expect(screen.getAllByText("Libre Def.")).toHaveLength(3);
    expect(screen.getAllByText("5% Def.")).toHaveLength(1);
    expect(screen.getAllByText("N/D")).toHaveLength(1);
    // The footer counter agrees with the cells.
    expect(screen.getByText("3")).toBeTruthy();
  });
});
