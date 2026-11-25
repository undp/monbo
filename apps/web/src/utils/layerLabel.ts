import type { MapData } from "@/interfaces/DeforestationAnalysis";

type LayerName = Pick<MapData, "id" | "name" | "alias">;

/** Display a layer even when metadata for the current language is missing. */
export const layerLabel = (
  map: LayerName,
  style: "full" | "short" = "full"
): string => {
  const name = map.name?.trim();
  const alias = map.alias?.trim();
  if (style === "short") return alias || name || String(map.id);
  if (name && alias && name !== alias) return `${name} (${alias})`;
  return name || alias || String(map.id);
};
