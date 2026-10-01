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

/** The layer got a new raster after the analysis: its images would not match. */
export class MapLayerChangedError extends Error {
  constructor() {
    super("The map layer changed since the analysis");
    this.name = "MapLayerChangedError";
  }
}

export const getMaps = async (language: string): Promise<MapData[]> => {
  // Names, aliases and considerations come back in this language.
  const response = await fetch(
    `${GET_MAPS_URL}?language=${encodeURIComponent(language)}`
  );
  if (!response.ok) {
    throw new Error("Error on get maps");
  }

  return response.json();
};

export const analizeDeforestation = async (
  data: FarmData[],
  selectedMaps: MapData[]
): Promise<DeforestationAnalysisMapResults[]> => {
  const response = await fetch(DEFORESTATION_ANALYSIS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      farms: data.map(({ id, polygon }) => ({
        id,
        type: polygon.type,
        details: polygon.details,
      })),
      maps: map(selectedMaps, "id"),
    }),
  });
  if (!response.ok) {
    throw new Error("Error on analize deforestation");
  }

  return response.json();
};

export const generatePolygonDeforestationImage = async (
  mapId: number,
  feature: GeoJsonFeature,
  includeSatelitalBackground: boolean = true,
  version?: number
): Promise<Blob> => {
  const url = `${DEFORESTATION_ANALYSIS_IMAGE_GENERATION_URL}?include_satelital_background=${includeSatelitalBackground}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mapId,
      feature,
      version,
    }),
  });
  if (response.status === 409) {
    throw new MapLayerChangedError();
  }
  if (!response.ok) {
    throw new Error("Error on generate polygon deforestation image");
  }

  return response.blob();
};
