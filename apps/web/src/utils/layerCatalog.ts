import type { MapData } from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";

/**
 * A category and its layers. `category` is null for the layers whose `categoryId`
 * names no category the country publishes: they are listed apart, never under a
 * guessed polarity or threshold.
 */
export interface CategoryLayers {
  category: LayerCategory | null;
  layers: MapData[];
}

/**
 * Groups a country's layers under its categories, both in the API's order. Every
 * category is returned, with or without layers; the layers of an unknown category
 * come last, in one group without a category.
 */
export const groupLayersByCategory = (
  categories: LayerCategory[],
  maps: MapData[]
): CategoryLayers[] => {
  const known = new Set(categories.map((category) => category.id));
  const groups: CategoryLayers[] = categories.map((category) => ({
    category,
    layers: maps.filter((map) => map.categoryId === category.id),
  }));
  const others = maps.filter((map) => !known.has(map.categoryId));
  return others.length > 0 ? [...groups, { category: null, layers: others }] : groups;
};

export interface LayerPeriod {
  /** The analysis window, baseline → comparison year ("2020 → 2023"). */
  window: string | null;
  /** The dataset's own range, as its country wrote it ("Datos entre 2000 y 2023"). */
  dataRange: string | null;
}

/**
 * The period of a layer. What backs a due diligence is the analysis window (the
 * loss after the baseline), not the years the dataset spans, so the window comes
 * first and the dataset's range only completes it.
 */
export const layerPeriod = (map: MapData): LayerPeriod => ({
  window:
    map.baseline != null && map.comparedAgainst != null
      ? `${map.baseline} → ${map.comparedAgainst}`
      : map.baseline != null
        ? String(map.baseline)
        : null,
  dataRange: map.contentDate ?? null,
});

/**
 * Whether an address a country's admin wrote (a reference, a link in a layer's
 * considerations) may be a link: only web addresses. Anything else, from
 * `javascript:` to a path of this app or `mailto:`, is shown as text.
 */
export const isWebUrl = (url: string | null | undefined): url is string =>
  !!url && /^https?:\/\//i.test(url);
