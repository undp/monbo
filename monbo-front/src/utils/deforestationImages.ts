import { flatten } from "lodash";
import { generateGeoJsonFeature } from "@/utils/geojson";
import pLimit from "p-limit";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION } from "@/config/env";
import { generatePolygonDeforestationImage } from "@/api/deforestationAnalysis";

export const fetchDeforestationImages = async (
  selectedMapsForReport: MapData[],
  selectedFarmsForReport: FarmData[],
  deforestationAnalysisResults: DeforestationAnalysisMapResults[]
): Promise<{ mapId: number; farmId: string; url: string }[]> => {
  const payloads = flatten(
    selectedMapsForReport.map(({ id: mapId }) =>
      selectedFarmsForReport
        .map((farm) => {
          const hasResults = !!deforestationAnalysisResults
            .find((m) => m.mapId === mapId)
            ?.farmResults.some(
              ({ farmId, value }) => farmId === farm.id && value !== null
            );
          if (hasResults)
            return {
              mapId,
              farmId: farm.id,
              farmGeoJson: generateGeoJsonFeature(farm),
            };
          return null;
        })
        .filter((p) => p !== null)
    )
  );

  const includeSatelitalBackground =
    !MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION ||
    payloads.length <=
      MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION;

  const limit = pLimit(20);

  const promises = payloads.map((payload) =>
    limit(() =>
      generatePolygonDeforestationImage(
        payload.mapId,
        payload.farmGeoJson,
        includeSatelitalBackground
      ).then((blob) => ({
        mapId: payload.mapId,
        farmId: payload.farmId,
        url: URL.createObjectURL(blob),
      }))
    )
  );

  const results = await Promise.all(promises);
  return results;
};
