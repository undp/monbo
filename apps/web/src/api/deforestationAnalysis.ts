import {
  GET_MAPS_URL,
  DEFORESTATION_ANALYSIS_URL,
  DEFORESTATION_ANALYSIS_IMAGE_GENERATION_URL,
} from "@/config/env";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { map } from "lodash";
import { GeoJsonFeature } from "@/hooks/useGeoJsonDownload";
import type { components } from "./schema";

/** The layer got a new raster after the analysis: its images would not match. */
export class MapLayerChangedError extends Error {
  constructor() {
    super("The map layer changed since the analysis");
    this.name = "MapLayerChangedError";
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
export const analizeDeforestation = async (
  data: FarmData[],
  selectedMaps: MapData[],
  country: string
): Promise<DeforestationAnalysisMapResults[]> => {
  const body: components["schemas"]["AnalizeBody"] = {
    country,
    farms: data.map(({ id, polygon }) => ({
      id,
      type: polygon.type,
      details: polygon.details,
    })),
    maps: map(selectedMaps, "id"),
  };
  const response = await fetch(DEFORESTATION_ANALYSIS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Error on analize deforestation");
  }

  return response.json();
};

export const generatePolygonDeforestationImage = async (
  country: string,
  mapId: number,
  feature: GeoJsonFeature,
  includeSatelitalBackground: boolean = true,
  version?: number
): Promise<Blob> => {
  const url = `${DEFORESTATION_ANALYSIS_IMAGE_GENERATION_URL}?include_satelital_background=${includeSatelitalBackground}`;
  const body: components["schemas"]["GenerateImageBody"] = {
    country,
    mapId,
    feature,
    version,
  };
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.status === 409) {
    throw new MapLayerChangedError();
  }
  if (!response.ok) {
    throw new Error("Error on generate polygon deforestation image");
  }

  return response.blob();
};
