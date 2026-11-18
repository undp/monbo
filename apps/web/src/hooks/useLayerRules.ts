import { useCallback, useContext, useMemo } from "react";
import { DataContext } from "@/context/DataContext";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import {
  categoryRule,
  layerCategory,
  type ClassificationRule,
} from "@/utils/layerResults";

export interface LayerReading {
  /** Null when the layer's category isn't among the country's categories. */
  category: LayerCategory | null;
  /** Null with the category: the layer's results are then `unknown`. */
  rule: ClassificationRule | null;
}

const NO_READING: LayerReading = { category: null, rule: null };

/**
 * How each layer of the analysis reads: its category and its rule. The layers are
 * the analysis's (they keep a hidden layer's metadata while results refer to it),
 * the categories the selected country's.
 */
export const useLayerRules = () => {
  const {
    territorialAnalysisParams: { selectedMaps },
    availableCategories,
  } = useContext(DataContext);

  const readings = useMemo(
    () =>
      new Map(
        selectedMaps.map((layer) => {
          const category = layerCategory(layer, availableCategories);
          return [
            layer.id,
            { category, rule: category ? categoryRule(category) : null },
          ];
        })
      ),
    [selectedMaps, availableCategories]
  );

  return useCallback(
    (layerId: number | null | undefined): LayerReading =>
      (layerId !== null && layerId !== undefined && readings.get(layerId)) ||
      NO_READING,
    [readings]
  );
};

/** How one layer of the analysis reads (see useLayerRules). */
export const useLayerReading = (
  layerId: number | null | undefined
): LayerReading => {
  const readLayer = useLayerRules();
  return useMemo(() => readLayer(layerId), [readLayer, layerId]);
};
