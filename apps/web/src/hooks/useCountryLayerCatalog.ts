import { useCallback, useEffect, useRef, useState } from "react";
import { getMaps } from "@/api/layerAnalysis";
import { getLayerCategories } from "@/api/layerCategories";
import type { MapData } from "@/interfaces/LayerAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";

export interface CountryLayerCatalog {
  categories: LayerCategory[];
  maps: MapData[];
}

export type CountryLayerCatalogState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  | { status: "ready"; catalog: CountryLayerCatalog };

type Settled =
  | { key: string; attempt: number; catalog: CountryLayerCatalog }
  | { key: string; attempt: number; failed: true };

const fetchCatalog = async (
  country: string,
  language: string
): Promise<CountryLayerCatalog> => {
  const [categories, maps] = await Promise.all([
    getLayerCategories(country),
    getMaps(language, country),
  ]);
  return { categories, maps };
};

/**
 * A country's categories (GET /categories) and public layers (GET /maps, texts in
 * `language`), for the methodology page. Any country, not only the session's: it
 * never reads or writes the session's country. Each country and language is
 * fetched once while the component lives, so switching back to a tab doesn't fetch
 * it again; a failed request is forgotten, so a retry fetches. A response for a
 * country that is no longer asked for is dropped.
 */
export function useCountryLayerCatalog(
  country: string | null,
  language: string
): CountryLayerCatalogState {
  const catalogs = useRef(new Map<string, Promise<CountryLayerCatalog>>());
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled | null>(null);
  const key = country ? `${country}:${language}` : null;

  useEffect(() => {
    if (!country || !key) return;
    let catalog = catalogs.current.get(key);
    if (!catalog) {
      catalog = fetchCatalog(country, language);
      catalogs.current.set(key, catalog);
      catalog.catch((error) => {
        catalogs.current.delete(key);
        console.error(`Error loading the layers of ${country}:`, error);
      });
    }
    let current = true;
    catalog.then(
      (loaded) => current && setSettled({ key, attempt, catalog: loaded }),
      () => current && setSettled({ key, attempt, failed: true })
    );
    return () => {
      current = false;
    };
  }, [country, language, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!key) return { status: "idle" };
  if (!settled || settled.key !== key || settled.attempt !== attempt) {
    return { status: "loading" };
  }
  return "catalog" in settled
    ? { status: "ready", catalog: settled.catalog }
    : { status: "error", retry };
}
