import { chunk, uniq } from "lodash";
import { generateGeoJsonFeature } from "@/utils/geojson";
import pLimit from "p-limit";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { FarmData } from "@/interfaces/Farm";
import { MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION } from "@/config/env";
import {
  generatePolygonDeforestationImage,
  ImageRequestError,
} from "@/api/deforestationAnalysis";

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

/**
 * Whether a report's images get the satellite background: all of them, or none
 * above the limit. The API fetches one satellite image per farm, whatever the
 * number of maps, so the limit counts the farms that have images.
 */
export const includesSatelliteBackground = (farmsWithImages: number) =>
  !MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION ||
  farmsWithImages <=
    MAX_REQUESTS_FOR_SATELLITE_BACKGROUND_AT_DEFORESTATION_IMAGE_GENERATION;

/** The maps a farm has a result on, which are the images its report needs. */
export const mapsWithResults = (
  farm: FarmData,
  maps: MapData[],
  results: DeforestationAnalysisMapResults[]
) =>
  maps.flatMap(({ id: mapId }) => {
    const mapResults = results.find((m) => m.mapId === mapId);
    const hasResult = !!mapResults?.farmResults.some(
      ({ farmId, value }) => farmId === farm.id && value !== null
    );
    return mapResults && hasResult ? [mapResults] : [];
  });

// A large report's ZIP makes thousands of requests over minutes: a transient
// failure is retried instead of throwing the job away. Not a 409 (the layer
// changed: the job must stop) nor another 4xx, nor an abort.
const RETRY_DELAYS_MS = [500, 2000];
// A request that hangs would stall the whole job: each attempt gives up after this.
const REQUEST_TIMEOUT_MS = 60 * 1000;

const isTransient = (error: unknown) =>
  (error instanceof ImageRequestError && error.status >= 500) ||
  // fetch rejects with a TypeError when the network fails
  error instanceof TypeError ||
  (error instanceof DOMException && error.name === "TimeoutError");

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true }
    );
  });

const withRetries = async <T,>(
  request: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (signal?.aborted || !isTransient(error)) throw error;
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
      await sleep(RETRY_DELAYS_MS[attempt], signal);
    }
  }
};

/**
 * One farm's images, for the maps it has a result on: what a large report's ZIP
 * needs to render that farm's PDF. Its requests go through `limit`, shared by the
 * whole job, and are retried when they fail transiently.
 */
export const fetchFarmImages = ({
  country,
  farm,
  maps,
  results,
  includeSatelliteBackground,
  limit,
  signal,
}: {
  country: string;
  farm: FarmData;
  maps: MapData[];
  results: DeforestationAnalysisMapResults[];
  includeSatelliteBackground: boolean;
  limit: ReturnType<typeof pLimit>;
  signal?: AbortSignal;
}): Promise<DeforestationImageBlob[]> => {
  const feature = generateGeoJsonFeature(farm);
  return Promise.all(
    mapsWithResults(farm, maps, results).map((mapResults) =>
      limit(() =>
        withRetries(() => {
          signal?.throwIfAborted();
          const timeout = new AbortController();
          const timer = setTimeout(
            () =>
              timeout.abort(
                new DOMException("The image request timed out", "TimeoutError")
              ),
            REQUEST_TIMEOUT_MS
          );
          return generatePolygonDeforestationImage(
            country,
            mapResults.mapId,
            feature,
            includeSatelliteBackground,
            // The image must come from the raster the results were computed on.
            mapResults.version,
            signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal
          ).finally(() => clearTimeout(timer));
        }, signal)
      ).then((blob) => ({ mapId: mapResults.mapId, farmId: farm.id, blob }))
    )
  );
};

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

  const includeSatelitalBackground = includesSatelliteBackground(
    uniq(payloads.map((p) => p.farmId)).length
  );

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
