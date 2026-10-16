import { LARGE_REPORT_FARM_PAGES } from "@/config/constants";
import type { DeforestationAnalysisMapResults } from "@/interfaces/DeforestationAnalysis";
import type { FarmData } from "@/interfaces/Farm";

/**
 * The farm pages of a report: its (farm, layer) pairs with a result, one page each
 * in the complete PDF. `results` holds only the selected layers.
 */
export const countFarmPages = (
  farms: FarmData[],
  results: DeforestationAnalysisMapResults[]
): number => {
  const selected = new Set(farms.map(({ id }) => id));
  return results.reduce(
    (pages, layer) =>
      pages +
      layer.farmResults.filter(
        ({ farmId, value }) => value !== null && selected.has(farmId)
      ).length,
    0
  );
};

/** A large report is downloaded only as a ZIP, built farm by farm. */
export const isLargeReport = (farmPages: number): boolean =>
  farmPages > LARGE_REPORT_FARM_PAGES;
