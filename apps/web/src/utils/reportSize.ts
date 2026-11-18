import { LARGE_REPORT_FARM_PAGES } from "@/config/constants";
import type { LayerAnalysisMapResults } from "@/interfaces/LayerAnalysis";
import type { FarmData } from "@/interfaces/Farm";

/**
 * The farm pages of a report, as the complete PDF has them: one sheet per selected
 * farm (also when none of its results could be computed) and one map page per
 * selected (farm, layer) pair with a result. `results` holds only the selected layers.
 */
export const countFarmPages = (
  farms: FarmData[],
  results: LayerAnalysisMapResults[]
): number => {
  const selected = new Set(farms.map(({ id }) => id));
  const mapPages = results.reduce(
    (pages, layer) =>
      pages +
      layer.farmResults.filter(
        ({ farmId, value }) => value !== null && selected.has(farmId)
      ).length,
    0
  );
  return selected.size + mapPages;
};

/** A large report is downloaded only as a ZIP, built farm by farm. */
export const isLargeReport = (farmPages: number): boolean =>
  farmPages > LARGE_REPORT_FARM_PAGES;
