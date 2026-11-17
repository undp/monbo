import { beforeEach, describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { setRuntimeConfig } from "@/config/runtime";
import { useDeforestationFreeResultsCountByMap } from "@/hooks/useDeforestationFreeResultsCountByMap";
import { createTestI18n } from "@/test/i18n";
import { makeFarm, makeMap, makeMapResults } from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { deforestationRule, groupFarmsByResult } from "./layerResults";
import {
  deforestationResultReportText,
  deforestationResultShortText,
} from "./resultLabels";

const tFor = async (locale: "es" | "en") =>
  (await createTestI18n(locale)).getFixedT(locale) as TFunction;

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
});

describe("deforestationResultShortText", () => {
  it("names each class, in Spanish", async () => {
    const t = await tFor("es");
    expect(deforestationResultShortText(0, t, "es")).toBe("Libre Def.");
    // Below the threshold is free, not "< 2% Def.".
    expect(deforestationResultShortText(0.005, t, "es")).toBe("Libre Def.");
    expect(deforestationResultShortText(0.05, t, "es")).toBe("5% Def.");
    expect(deforestationResultShortText(null, t, "es")).toBe("N/D");
    expect(deforestationResultShortText(undefined, t, "es")).toBe("N/D");
  });

  it("names each class, in English", async () => {
    const t = await tFor("en");
    expect(deforestationResultShortText(0.02, t, "en")).toBe("Def. Free");
    expect(deforestationResultShortText(0.05, t, "en")).toBe("5% Def.");
    expect(deforestationResultShortText(null, t, "en")).toBe("N/A");
  });
});

describe("deforestationResultReportText", () => {
  it("names each class on the PDF farm page", async () => {
    // lodash's upperCase drops the accents, as the report always printed them.
    const es = await tFor("es");
    expect(deforestationResultReportText(0.005, es, "es")).toBe(
      "LIBRE DE DEFORESTACION"
    );
    expect(deforestationResultReportText(0.05, es, "es")).toBe(
      "5% DEFORESTACIÓN"
    );
    const en = await tFor("en");
    expect(deforestationResultReportText(0, en, "en")).toBe(
      "DEFORESTATION FREE"
    );
    expect(deforestationResultReportText(null, en, "en")).toBe("N/A");
  });
});

// The helpers agree with each other here; that the views use them is tested in
// MapView.test.tsx and DeforestationResultsTable.test.tsx.
describe("one classification across helpers", () => {
  it("gives the same free count in the counter hook, the grouping and both label helpers", async () => {
    const t = await tFor("es");
    const values = { F01: 0, F02: 0.005, F03: 0.02, F04: 0.05, F05: null };
    const farms = Object.keys(values).map((id) => makeFarm({ id }));
    const results = makeMapResults(1, values);

    const { result: counter } = await renderHookWithData(
      useDeforestationFreeResultsCountByMap,
      {
        context: makeDataContext({
          farmsData: farms,
          deforestationAnalysisParams: {
            polygonsSubset: "all",
            selectedMaps: [makeMap({ id: 1 })],
          },
          deforestationAnalysisResults: [results],
        }),
      }
    );
    const mapGroups = groupFarmsByResult(farms, results, deforestationRule());
    const tableCells = results.farmResults.map(({ value }) =>
      deforestationResultShortText(value, t, "es")
    );
    const pdfTexts = results.farmResults.map(({ value }) =>
      deforestationResultReportText(value, t, "es")
    );

    expect(counter.current[0].count).toBe(3);
    expect(mapGroups.ok).toHaveLength(3);
    expect(tableCells.filter((text) => text === "Libre Def.")).toHaveLength(3);
    expect(
      pdfTexts.filter((text) => text === "LIBRE DE DEFORESTACION")
    ).toHaveLength(3);
    // The null farm is "no data" everywhere, never free.
    expect(mapGroups.unknown.map(({ id }) => id)).toEqual(["F05"]);
    expect(tableCells[4]).toBe("N/D");
  });
});
