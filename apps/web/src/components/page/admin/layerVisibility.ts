import type { AdminLayer } from "@/interfaces/AdminLayer";

// Why a layer is not public, from the fields GC-2 computes for every layer. The
// public listing (`GET /maps`) offers a layer only when it is enabled, its category
// resolves and is enabled, its years fit the category and it has a raster.

export type LayerBlocker =
  // `category_issue`: the category doesn't resolve in the country
  | "unknown_category"
  | "invalid_category"
  | "unreadable_categories"
  // The category resolves but is disabled
  | "category_disabled"
  // `layer_issue`
  | "years_mismatch"
  | "missing_raster";

type VisibilityFields = Pick<
  AdminLayer,
  "enabled" | "category_issue" | "category_enabled" | "layer_issue"
>;

/**
 * What stops a layer from being public, whether it is enabled or not, or null.
 * One reason, in the order the admin fixes them: the category first (moving the
 * layer to another category also changes which years it needs), then its years,
 * then its raster.
 */
export const layerBlocker = (layer: VisibilityFields): LayerBlocker | null => {
  if (layer.category_issue) return layer.category_issue;
  if (!layer.category_enabled) return "category_disabled";
  return layer.layer_issue;
};

export type LayerVisibility =
  | { status: "public" }
  // Enabled by the admin, but hidden from the public app by `reason`
  | { status: "blocked"; reason: LayerBlocker }
  // Hidden by the admin; `reason` would also stop publishing it
  | { status: "hidden"; reason: LayerBlocker | null };

export const layerVisibility = (layer: VisibilityFields): LayerVisibility => {
  const reason = layerBlocker(layer);
  if (!layer.enabled) return { status: "hidden", reason };
  return reason ? { status: "blocked", reason } : { status: "public" };
};
