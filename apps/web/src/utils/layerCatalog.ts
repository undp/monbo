import type { MapData } from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory, LocalizedText } from "@/interfaces/LayerCategory";

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

/**
 * The period a layer covers: its `contentDate` as written by its country, else its
 * years ("2020–2023"), else null.
 */
export const layerPeriod = (map: MapData): string | null => {
  if (map.contentDate) return map.contentDate;
  if (map.baseline != null && map.comparedAgainst != null) {
    return `${map.baseline}–${map.comparedAgainst}`;
  }
  return map.baseline != null ? String(map.baseline) : null;
};

/** A text of the API (both languages) in the page's language; Spanish is the default. */
export const localizedText = (text: LocalizedText, language: string): string =>
  language === "en" ? text.en : text.es;
