import type { MapData } from "@/interfaces/LayerAnalysis";

// The fields of a layer that `GET /maps` returns in the requested language.
export const LAYER_TEXT_KEYS = [
  "name",
  "alias",
  "coverage",
  "source",
  "resolution",
  "contentDate",
  "updateFrequency",
  "publishDate",
  "considerations",
] as const;

export type LayerTexts = Pick<MapData, (typeof LAYER_TEXT_KEYS)[number]>;

export const layerTextsOf = (map: MapData): LayerTexts => ({
  name: map.name,
  alias: map.alias,
  coverage: map.coverage,
  source: map.source,
  resolution: map.resolution,
  contentDate: map.contentDate,
  updateFrequency: map.updateFrequency,
  publishDate: map.publishDate,
  considerations: map.considerations,
});

/** `map` with `texts` in place of its own; the calculation fields stay those of `map`. */
export const withLayerTexts = (map: MapData, texts?: LayerTexts): MapData => {
  if (!texts || LAYER_TEXT_KEYS.every((key) => map[key] === texts[key])) return map;
  return { ...map, ...texts };
};

/** Each layer's same-id entry of `by`, or the layer itself. Same array when nothing changed. */
export const replaceById = (layers: MapData[], by: MapData[]): MapData[] => {
  const replaced = layers.map((layer) => by.find((map) => map.id === layer.id) ?? layer);
  return replaced.every((layer, index) => layer === layers[index]) ? layers : replaced;
};
