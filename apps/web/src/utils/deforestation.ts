import { getOverlapThreshold } from "@/config/runtime";

// The deforestation result is classified in `utils/layerResults` (polarity, threshold
// and missing data); this only holds module 1's overlap check.
export const isOverlapAboveThreshold = (overlapValue: number) => {
  return 100 * overlapValue > getOverlapThreshold();
};
