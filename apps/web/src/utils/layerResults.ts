import { getDeforestationThreshold } from "@/config/runtime";
import type { DeforestationAnalysisMapResults } from "@/interfaces/DeforestationAnalysis";

// The one place that turns a layer result into ok / flagged / unknown. Every screen,
// counter and the PDF classify through here: a rule decided anywhere else can invert a
// polarity or count a missing result as clean, with no visible error.

/**
 * `avoid`: overlapping the layer is the finding (deforestation, protected areas).
 * `required`: not overlapping it is the finding (agricultural frontier).
 *
 * Local until the API publishes layer categories (GC-1); then it becomes the
 * contract's type, with the same values.
 */
export type Polarity = "avoid" | "required";

export interface ClassificationRule {
  polarity: Polarity;
  /** In percent (0-100). A finding strictly above it is flagged. */
  thresholdPercentage: number;
}

/** `unknown`: the API could not compute the result (`null`), or there is none. */
export type ResultClass = "ok" | "flagged" | "unknown";

/** The share of the farm that counts as a finding, between 0 and 1. */
export const findingRatio = (value: number, polarity: Polarity): number =>
  polarity === "avoid" ? value : 1 - value;

// Floating point puts a finding that is exactly on the threshold a hair above it:
// 100 × 0.07 is 7.000000000000001 and 100 × (1 − 0.58) is 42.00000000000001, which
// would flag a farm sitting on a 7% or 42% threshold. A finding is above the
// threshold only when it beats it by more than that rounding error: a few units in
// the last place (ULPs) at the scale of the numbers compared. For `required`, 1 − value
// is rounded at the scale of 1 (100 in percent), however small the finding.
// The tolerance is relative, not a fixed resolution, because the API accepts
// thresholds as small as it likes (see formatDeforestationPercentage).
const ROUNDING_ULPS = 8;

const isAboveThreshold = (
  findingPercentage: number,
  thresholdPercentage: number,
  polarity: Polarity
) => {
  const scale = Math.max(
    Math.abs(findingPercentage),
    Math.abs(thresholdPercentage),
    polarity === "required" ? 100 : 0
  );
  return (
    findingPercentage - thresholdPercentage >
    ROUNDING_ULPS * Number.EPSILON * scale
  );
};

export const classifyResult = (
  value: number | null | undefined,
  rule: ClassificationRule
): ResultClass => {
  if (value === null || value === undefined) return "unknown";
  return isAboveThreshold(
    100 * findingRatio(value, rule.polarity),
    rule.thresholdPercentage,
    rule.polarity
  )
    ? "flagged"
    : "ok";
};

/**
 * The rule for every layer until layers carry a category (GC-6): deforestation,
 * with the threshold published at GET /config.
 */
export const deforestationRule = (): ClassificationRule => ({
  polarity: "avoid",
  thresholdPercentage: getDeforestationThreshold(),
});

export const countResults = (
  values: Iterable<number | null | undefined>,
  rule: ClassificationRule
): Record<ResultClass, number> => {
  const counts: Record<ResultClass, number> = { ok: 0, flagged: 0, unknown: 0 };
  for (const value of values) counts[classifyResult(value, rule)] += 1;
  return counts;
};

/**
 * The farms of each class for one layer. A farm with no result in `mapResults`
 * (or no `mapResults` at all) is `unknown`.
 */
export const groupFarmsByResult = <Farm extends { id: string }>(
  farms: Farm[],
  mapResults: Pick<DeforestationAnalysisMapResults, "farmResults"> | undefined,
  rule: ClassificationRule
): Record<ResultClass, Farm[]> => {
  const valueByFarm = new Map(
    mapResults?.farmResults.map(({ farmId, value }) => [farmId, value])
  );
  const groups: Record<ResultClass, Farm[]> = {
    ok: [],
    flagged: [],
    unknown: [],
  };
  farms.forEach((farm) => {
    groups[classifyResult(valueByFarm.get(farm.id), rule)].push(farm);
  });
  return groups;
};
