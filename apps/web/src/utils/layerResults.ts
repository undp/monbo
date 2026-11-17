import { getDeforestationThreshold } from "@/config/runtime";
import type {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";

// The one place that turns a layer result into ok / flagged / unknown. Every screen,
// counter and the PDF classify through here: a rule decided anywhere else can invert a
// polarity or count a missing result as clean, with no visible error.

/**
 * `avoid`: overlapping the layer is the finding (deforestation, protected areas).
 * `required`: not overlapping it is the finding (agricultural frontier).
 */
export type Polarity = LayerCategory["polarity"];

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

/**
 * A `null` rule means the layer's category is unknown (disabled or deleted after the
 * analysis): its results are `unknown`, never read with another category's rule.
 */
export const classifyResult = (
  value: number | null | undefined,
  rule: ClassificationRule | null
): ResultClass => {
  if (value === null || value === undefined || rule === null) return "unknown";
  return isAboveThreshold(
    100 * findingRatio(value, rule.polarity),
    rule.thresholdPercentage,
    rule.polarity
  )
    ? "flagged"
    : "ok";
};

/**
 * The rule of the PDF report and the exports until they read categories (GC-7):
 * deforestation, with the threshold published at GET /config. Stage 2 uses
 * `categoryRule`.
 */
export const deforestationRule = (): ClassificationRule => ({
  polarity: "avoid",
  thresholdPercentage: getDeforestationThreshold(),
});

/** The rule of a category's layers. */
export const categoryRule = (
  category: Pick<LayerCategory, "polarity" | "thresholdPercentage">
): ClassificationRule => ({
  polarity: category.polarity,
  thresholdPercentage: category.thresholdPercentage,
});

/** The category of a layer among a country's categories, or null if it isn't there. */
export const layerCategory = (
  layer: Pick<MapData, "categoryId">,
  categories: LayerCategory[]
): LayerCategory | null =>
  categories.find(({ id }) => id === layer.categoryId) ?? null;

/** The rule of a layer, or null when its category isn't among `categories`. */
export const layerRule = (
  layer: Pick<MapData, "categoryId">,
  categories: LayerCategory[]
): ClassificationRule | null => {
  const category = layerCategory(layer, categories);
  return category ? categoryRule(category) : null;
};

export const countResults = (
  values: Iterable<number | null | undefined>,
  rule: ClassificationRule | null
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
  rule: ClassificationRule | null
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

/**
 * A farm's class in a category, from its class in each of the category's layers: a
 * finding in any layer is a finding; otherwise missing data in any layer is
 * `unknown`; only a farm with every layer `ok` is `ok`.
 */
export const classifyFarmInCategory = (classes: ResultClass[]): ResultClass => {
  if (classes.includes("flagged")) return "flagged";
  if (classes.length === 0 || classes.includes("unknown")) return "unknown";
  return "ok";
};

export interface LayerGroup<Layer> {
  /** Null for the layers whose category isn't among the country's categories. */
  category: LayerCategory | null;
  layers: Layer[];
}

/**
 * Layers by category, in the order of `categories` (the API's), each group's layers
 * by id. Categories without layers are left out. Layers whose category is missing
 * come last, in a group with a null category.
 */
export const groupLayersByCategory = <Layer extends Pick<MapData, "id" | "categoryId">>(
  layers: Layer[],
  categories: LayerCategory[]
): LayerGroup<Layer>[] => {
  const byId = (a: Layer, b: Layer) => a.id - b.id;
  const groups: LayerGroup<Layer>[] = categories
    .map((category) => ({
      category,
      layers: layers.filter(({ categoryId }) => categoryId === category.id).sort(byId),
    }))
    .filter(({ layers }) => layers.length > 0);
  const known = new Set(categories.map(({ id }) => id));
  const orphans = layers.filter(({ categoryId }) => !known.has(categoryId)).sort(byId);
  if (orphans.length > 0) groups.push({ category: null, layers: orphans });
  return groups;
};

export interface CategorySummary {
  category: LayerCategory;
  /** The analysed layers of the category. */
  layerIds: number[];
  /** Farms by their class in the category (see classifyFarmInCategory). */
  counts: Record<ResultClass, number>;
}

/**
 * Per category with analysed layers, how many of `farms` are ok, flagged or unknown
 * in it. Layers whose category is missing have no rule and no summary.
 */
export const summarizeCategories = (
  farms: { id: string }[],
  results: DeforestationAnalysisMapResults[],
  layers: Pick<MapData, "id" | "categoryId">[],
  categories: LayerCategory[]
): CategorySummary[] => {
  const analysed = layers.filter(({ id }) => results.some(({ mapId }) => mapId === id));
  const valuesByLayer = new Map(
    results.map(({ mapId, farmResults }) => [
      mapId,
      new Map(farmResults.map(({ farmId, value }) => [farmId, value])),
    ])
  );
  return groupLayersByCategory(analysed, categories).flatMap(({ category, layers }) => {
    if (!category) return [];
    const rule = categoryRule(category);
    const counts: Record<ResultClass, number> = { ok: 0, flagged: 0, unknown: 0 };
    farms.forEach((farm) => {
      const classes = layers.map(({ id }) =>
        classifyResult(valuesByLayer.get(id)?.get(farm.id), rule)
      );
      counts[classifyFarmInCategory(classes)] += 1;
    });
    return [{ category, layerIds: layers.map(({ id }) => id), counts }];
  });
};
