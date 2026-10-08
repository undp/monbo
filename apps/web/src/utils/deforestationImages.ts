import { chunk, uniq } from "lodash";
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

// The API keeps the last 256 satellite images it fetched from Google (one per
// farm; the map doesn't enter). A farm's requests for every map have to reach the
// API while its image is still there, so the requests go out by groups of farms,
// map by map within each group: between a farm's first and last request there
// are at most FARMS_PER_GROUP - 1 other farms, with room left for other reports
// being generated at the same time. Within a group the order is map-major: the
// first map's requests fetch from Google with every slot in flight, and the next
// maps' hit the cache. Grouping each farm's requests instead measured twice as
// slow (fewer Google calls in parallel).
const FARMS_PER_GROUP = 64;

export const fetchDeforestationImages = async (
  country: string,
  selectedMapsForReport: MapData[],
  selectedFarmsForReport: FarmData[],
  deforestationAnalysisResults: DeforestationAnalysisMapResults[]
): Promise<DeforestationImageBlob[]> => {
  const payloads = chunk(selectedFarmsForReport, FARMS_PER_GROUP).flatMap(
    (farms) =>
      selectedMapsForReport.flatMap(({ id: mapId }) =>
        farms
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

  // One queue for every group, so the requests of the next group start as soon as
  // a slot frees up.
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
