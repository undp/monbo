import type { AdminCategories, AdminLayer } from "@/interfaces/AdminLayer";

/**
 * A layer's period in the admin's list: its years when it has both, "current"
 * when it has none and its category is not temporal, and nothing to show
 * otherwise (a temporal layer without its years, or a category that doesn't
 * resolve).
 */
export type LayerPeriod =
  | { kind: "years"; baseline: number; comparedAgainst: number }
  | { kind: "current" }
  | { kind: "unknown" };

export const layerPeriod = (
  layer: Pick<AdminLayer, "baseline" | "compared_against" | "category_id" | "category_issue">,
  categories: AdminCategories | null
): LayerPeriod => {
  if (layer.baseline !== null && layer.compared_against !== null) {
    return { kind: "years", baseline: layer.baseline, comparedAgainst: layer.compared_against };
  }
  const category = layer.category_issue
    ? undefined
    : categories?.categories.find(({ id }) => id === layer.category_id);
  if (layer.baseline === null && layer.compared_against === null && category && !category.temporal) {
    return { kind: "current" };
  }
  return { kind: "unknown" };
};
