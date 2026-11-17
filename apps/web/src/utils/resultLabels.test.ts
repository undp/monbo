import { beforeEach, describe, expect, it } from "vitest";
import type { TFunction } from "i18next";
import { setRuntimeConfig } from "@/config/runtime";
import { useDeforestationFreeResultsCountByMap } from "@/hooks/useDeforestationFreeResultsCountByMap";
import { createTestI18n } from "@/test/i18n";
import {
  makeCategory,
  makeFarm,
  makeFrontierCategory,
  makeMap,
  makeMapResults,
} from "@/test/factories";
import { makeDataContext, renderHookWithData } from "@/test/renderWithData";
import { categoryRule, groupFarmsByResult } from "./layerResults";
import { deforestationResultReportText, layerResultText } from "./resultLabels";

const tFor = async (locale: "es" | "en") =>
  (await createTestI18n(locale)).getFixedT(locale) as TFunction;

beforeEach(() => {
  setRuntimeConfig({
    deforestationThresholdPercentage: 2,
    overlapThresholdPercentage: 1,
  });
});

describe("layerResultText", () => {
  const deforestation = makeCategory({ thresholdPercentage: 2 });
  const frontier = makeFrontierCategory();

  it("names each class of an avoid category, in Spanish", async () => {
    const t = await tFor("es");
    expect(layerResultText(0, deforestation, t, "es")).toBe("Libre de deforestación");
    // Below the threshold is ok, without a percentage (D16).
    expect(layerResultText(0.005, deforestation, t, "es")).toBe(
      "Libre de deforestación"
    );
    expect(layerResultText(0.05, deforestation, t, "es")).toBe(
      "5% · Con deforestación"
    );
    expect(layerResultText(null, deforestation, t, "es")).toBe("Sin dato");
    expect(layerResultText(undefined, deforestation, t, "es")).toBe("Sin dato");
  });

  it("shows the finding of a required category, not its coverage", async () => {
    const t = await tFor("es");
    expect(layerResultText(0.82, frontier, t, "es")).toBe(
      "18% · Fuera de la frontera agrícola"
    );
    expect(layerResultText(0.96, frontier, t, "es")).toBe(
      "Dentro de la frontera agrícola"
    );
  });

  it("never shows a flagged finding as the threshold", async () => {
    const t = await tFor("es");
    // 1 − 0.9496 = 5.04% outside the frontier: above 5, but 5% with one decimal.
    expect(layerResultText(0.9496, frontier, t, "es")).toBe(
      "> 5% · Fuera de la frontera agrícola"
    );
    expect(layerResultText(0.94, frontier, t, "es")).toBe(
      "6% · Fuera de la frontera agrícola"
    );
  });

  it("uses the category's English texts", async () => {
    const t = await tFor("en");
    expect(layerResultText(0.82, frontier, t, "en")).toBe(
      "18% · Outside the agricultural frontier"
    );
    expect(layerResultText(null, frontier, t, "en")).toBe("No data");
  });

  it("never shows a flagged finding as 0% with a threshold of 0", async () => {
    const t = await tFor("es");
    const strict = makeCategory({ thresholdPercentage: 0 });
    const strictFrontier = makeFrontierCategory({ thresholdPercentage: 0 });
    // 0.04% of the farm: flagged, too small for one decimal.
    expect(layerResultText(0.0004, strict, t, "es")).toBe("< 0,1% · Con deforestación");
    expect(layerResultText(0.00049, strict, t, "es")).toBe(
      "< 0,1% · Con deforestación"
    );
    // Its required mirror: 0.04% of the farm outside the frontier.
    expect(layerResultText(0.9996, strictFrontier, t, "es")).toBe(
      "< 0,1% · Fuera de la frontera agrícola"
    );
    // At the display resolution and above, the percentage itself.
    expect(layerResultText(0.001, strict, t, "es")).toBe("0,1% · Con deforestación");
    expect(layerResultText(0.0123, strict, t, "es")).toBe("1,2% · Con deforestación");
    // Nothing at all is ok, not "< 0,1%".
    expect(layerResultText(0, strict, t, "es")).toBe("Libre de deforestación");
    expect(layerResultText(1, strictFrontier, t, "es")).toBe(
      "Dentro de la frontera agrícola"
    );
    const en = await tFor("en");
    expect(layerResultText(0.0004, strict, en, "en")).toBe(
      "< 0.1% · With deforestation"
    );
  });

  it("reads every result as no data when the category is missing", async () => {
    const t = await tFor("es");
    expect(layerResultText(0, null, t, "es")).toBe("Sin dato");
    expect(layerResultText(0.9, null, t, "es")).toBe("Sin dato");
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
  it("gives the same free count in the counter hook, the grouping and the table text", async () => {
    const t = await tFor("es");
    const category = makeCategory({ thresholdPercentage: 2 });
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
          availableCategories: [category],
        }),
      }
    );
    const mapGroups = groupFarmsByResult(farms, results, categoryRule(category));
    const tableCells = results.farmResults.map(({ value }) =>
      layerResultText(value, category, t, "es")
    );
    // The PDF still reads the deforestation rule (GET /config: also 2).
    const pdfTexts = results.farmResults.map(({ value }) =>
      deforestationResultReportText(value, t, "es")
    );

    expect(counter.current[0].count).toBe(3);
    expect(mapGroups.ok).toHaveLength(3);
    expect(
      tableCells.filter((text) => text === "Libre de deforestación")
    ).toHaveLength(3);
    expect(
      pdfTexts.filter((text) => text === "LIBRE DE DEFORESTACION")
    ).toHaveLength(3);
    // The null farm is "no data" everywhere, never free.
    expect(mapGroups.unknown.map(({ id }) => id)).toEqual(["F05"]);
    expect(tableCells[4]).toBe("Sin dato");
  });
});
