import {
  GET_MAPS_URL,
  LAYER_ANALYSIS_URL,
  LAYER_ANALYSIS_IMAGE_GENERATION_URL,
} from "@/config/env";
import {
  LayerAnalysisMapResults,
  MapData,
} from "@/interfaces/LayerAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { map } from "lodash";
import { GeoJsonFeature } from "@/hooks/useGeoJsonDownload";
import { usageHeaders } from "@/utils/usageSession";
import type { components } from "./schema";

/** The layer got a new raster after the analysis: its images would not match. */
export class MapLayerChangedError extends Error {
  constructor() {
    super("The map layer changed since the analysis");
    this.name = "MapLayerChangedError";
  }
}

/** `/generate-image` answered with an error status (other than 409). */
export class ImageRequestError extends Error {
  constructor(readonly status: number) {
    super(`Error on generate layer image (HTTP ${status})`);
    this.name = "ImageRequestError";
  }
}

export const getMaps = async (
  language: string,
  country?: string | null
): Promise<MapData[]> => {
  // Names, aliases and considerations come back in this language; with a
  // country, only that country's layers.
  const params = new URLSearchParams({ language });
  if (country) params.set("country", country);
  const response = await fetch(`${GET_MAPS_URL}?${params}`);
  if (!response.ok) {
    throw new Error("Error on get maps");
  }

  return response.json();
};

// Layer ids are numbered within each country: every call names the country.
export const analyzeLayers = async (
  data: FarmData[],
  selectedMaps: MapData[],
  country: string
): Promise<LayerAnalysisMapResults[]> => {
  const body: components["schemas"]["AnalyzeBody"] = {
    country,
    farms: data.map(({ id, polygon }) => ({
      id,
      type: polygon.type,
      details: polygon.details,
    })),
    maps: map(selectedMaps, "id"),
  };
  const response = await fetch(LAYER_ANALYSIS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...usageHeaders(country),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Error on layer analysis");
  }

  return response.json();
};

export const generateLayerImage = async (
  country: string,
  mapId: number,
  feature: GeoJsonFeature,
  includeSatelitalBackground: boolean = true,
  version?: number,
  signal?: AbortSignal,
  pointRadiusMeters?: number
): Promise<Blob> => {
  const url = `${LAYER_ANALYSIS_IMAGE_GENERATION_URL}?include_satelital_background=${includeSatelitalBackground}`;
  const body: components["schemas"]["GenerateImageBody"] = {
    country,
    mapId,
    feature,
    version,
    pointRadiusMeters,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 409) {
    throw new MapLayerChangedError();
  }
  if (!response.ok) {
    throw new ImageRequestError(response.status);
  }

  return response.blob();
};
