import { useContext, useMemo } from "react";
import { DataContext } from "@/context/DataContext";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import type { MapData } from "@/interfaces/LayerAnalysis";

/**
 * The layers of the current analysis that have results: the only ones a report
 * can include. In the analysis's order.
 */
export const useAnalysedLayers = (): MapData[] => {
  const {
    territorialAnalysisParams: { selectedMaps },
  } = useContext(DataContext);
  const { territorialAnalysisResults } = useVisibleDataForAnalysisPage();
  return useMemo(
    () =>
      selectedMaps.filter(({ id }) =>
        territorialAnalysisResults.some(({ mapId }) => mapId === id)
      ),
    [selectedMaps, territorialAnalysisResults]
  );
};
