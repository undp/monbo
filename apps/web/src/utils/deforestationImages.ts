import { flatten, uniq } from "lodash";
import { generateGeoJsonFeature } from "@/utils/geojson";
import pLimit from "p-limit";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION } from "@/config/env";
import { generatePolygonDeforestationImage } from "@/api/deforestationAnalysis";

export interface DeforestationImageBlob {
  mapId: number;
  farmId: string;
  blob: Blob;
}

export const fetchDeforestationImages = async (
  country: string,
  selectedMapsForReport: MapData[],
  selectedFarmsForReport: FarmData[],
  deforestationAnalysisResults: DeforestationAnalysisMapResults[]
): Promise<DeforestationImageBlob[]> => {
  // Map-major on purpose: the first map's requests fetch each farm's satellite
  // image, and the API serves the next maps' from its cache. Grouping a farm's
  // requests instead measured twice as slow (fewer Google calls in parallel).
  const payloads = flatten(
    selectedMapsForReport.map(({ id: mapId }) =>
      selectedFarmsForReport
        .map((farm) => {
          const mapResults = deforestationAnalysisResults.find(
            (m) => m.mapId === mapId
          );
          const hasResults = !!mapResults?.farmResults.some(
            ({ farmId, value }) => farmId === farm.id && value !== null
          );
          if (mapResults && hasResults)
            return {
              mapId,
              // The image must come from the raster the results were computed on.
              version: mapResults.version,
              farmId: farm.id,
              farmGeoJson: generateGeoJsonFeature(farm),
            };
          return null;
        })
        .filter((p) => p !== null)
    )
  );

  // The API fetches one satellite image per farm, whatever the number of maps.
  const satelliteRequests = uniq(payloads.map((p) => p.farmId)).length;
  const includeSatelitalBackground =
    !MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION ||
    satelliteRequests <=
      MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION;

  const limit = pLimit(20);

  const promises = payloads.map((payload) =>
    limit(() =>
      generatePolygonDeforestationImage(
        country,
        payload.mapId,
        payload.farmGeoJson,
        includeSatelitalBackground,
        payload.version
      ).then((blob) => ({
        mapId: payload.mapId,
        farmId: payload.farmId,
        blob,
      }))
    )
  );

  return Promise.all(promises);
};
