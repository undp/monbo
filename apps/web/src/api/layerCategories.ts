import { GET_CATEGORIES_URL } from "@/config/env";
import type { LayerCategory } from "@/interfaces/LayerCategory";

/**
 * A country's enabled layer categories, in the order the country keeps them. Texts
 * come in every language and `thresholdPercentage` is already resolved.
 */
export const getLayerCategories = async (
  country: string
): Promise<LayerCategory[]> => {
  const params = new URLSearchParams({ country });
  const response = await fetch(`${GET_CATEGORIES_URL}?${params}`);
  if (!response.ok) {
    throw new Error("Error on get layer categories");
  }
  return response.json();
};
