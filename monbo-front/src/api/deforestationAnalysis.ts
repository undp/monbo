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

export const getMaps = async (): Promise<MapData[]> => {
  const response = await fetch(GET_MAPS_URL);
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
        path: polygon.type === "polygon" ? polygon.details?.path : null,
        center: polygon.details?.center ?? null,
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
  feature: GeoJsonFeature
): Promise<Blob> => {
  const response = await fetch(DEFORESTATION_ANALYSIS_IMAGE_GENERATION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mapId,
      feature,
    }),
  });
  if (!response.ok) {
    throw new Error("Error on generate polygon deforestation image");
  }

  return response.blob();
};
