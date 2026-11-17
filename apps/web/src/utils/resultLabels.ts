import type { TFunction } from "i18next";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { layerResult } from "./layerCategories";

/**
 * The text of a layer result in stage 2 (results table and map popup), from its
 * class under the layer's category: the category's `ok` label; the finding and the
 * `flagged` label; or "no data". A layer whose category is missing (null) has no
 * rule, so every result is "no data". It is the report's reading of the result
 * (`layerResult`), in one line, so stage 2 and the PDF can't disagree.
 */
export const layerResultText = (
  value: number | null | undefined,
  category: LayerCategory | null,
  t: TFunction,
  language: string
): string => {
  const { resultClass, findingText, label } = layerResult(
    value,
    category,
    t,
    language
  );
  // A finding under 0.1% with a threshold of 0 reads "< 0,1%", never "0%" next to
  // the flagged label (formatDeforestationPercentage).
  return resultClass === "flagged" ? `${findingText} · ${label}` : label;
};
