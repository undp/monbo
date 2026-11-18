import type { TFunction } from "i18next";
import type { AdminCategory, AdminLanguage, AdminLayer } from "@/interfaces/AdminLayer";
import { AS_TEXT } from "@/utils/asText";
import { adminLayerText } from "./adminLayerText";

// The API's rules that keep a published layer's meaning stable (GC-2, design §4),
// as locks the admin sees before trying: each says why and which layers to hide.
// The API checks them again under its lock; these only explain them up front.

export type CategoryLockReason =
  // The country's categories file can't be read: no category can be written
  | "unreadable"
  // Hide these published layers first
  | "publishedLayers"
  // The category has layers, published or not
  | "anyLayers";

export interface CategoryLock {
  reason: CategoryLockReason;
  /** How many layers cause it (the API's count). */
  count: number;
  /** Their aliases, when the layers list has them. */
  layers: string[];
}

export interface CategoryLocks {
  /** Enabling or disabling the category. */
  enabled: CategoryLock | null;
  polarity: CategoryLock | null;
  temporal: CategoryLock | null;
}

const UNREADABLE: CategoryLock = { reason: "unreadable", count: 0, layers: [] };

/**
 * The locks of a category. `layers` is the country's layer list (for names); the
 * counts come from the category, so the locks agree with the API's numbers even if
 * the two requests saw different moments. A new category (`null`) has none.
 */
export const categoryLocks = (
  category: AdminCategory | null,
  layers: AdminLayer[],
  readable: boolean,
  language: AdminLanguage
): CategoryLocks => {
  if (!readable) {
    return { enabled: UNREADABLE, polarity: UNREADABLE, temporal: UNREADABLE };
  }
  if (!category) return { enabled: null, polarity: null, temporal: null };
  const own = layers.filter((layer) => layer.category_id === category.id);
  const names = (list: AdminLayer[]) =>
    list.map((layer) => adminLayerText(layer, "alias", language));
  const published: CategoryLock | null =
    category.publishedLayerCount > 0
      ? {
          reason: "publishedLayers",
          count: category.publishedLayerCount,
          layers: names(own.filter((layer) => layer.enabled)),
        }
      : null;
  return {
    enabled: published,
    polarity: published,
    temporal:
      category.layerCount > 0
        ? { reason: "anyLayers", count: category.layerCount, layers: names(own) }
        : null,
  };
};

/**
 * Why a control is locked, naming the layers (or how many) and what to do. `control`
 * picks the sentence: the same published layers block the switch and the polarity
 * for different reasons.
 */
export const describeLock = (
  lock: CategoryLock,
  control: keyof CategoryLocks,
  t: TFunction
): string =>
  lock.reason === "unreadable"
    ? t("admin:categories:locks:unreadable")
    : t(`admin:categories:locks:${control}`, {
        layers: lock.layers.length
          ? lock.layers.join(", ")
          : t("admin:categories:locks:layerCount", { count: lock.count }),
        ...AS_TEXT,
      });
