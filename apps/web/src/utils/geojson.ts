import { FarmData } from "@/interfaces/Farm";
import { Coordinates, PolygonPart } from "@/interfaces/Map";
import { GeoJsonData, GeoJsonFeature } from "@/hooks/useGeoJsonDownload";
import { getRowCommonDataAsObject } from "./download";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { formatDeforestationPercentage } from "./numbers";
import { layerLabel } from "./layerLabel";

const toPositions = (ring: Coordinates[]) => ring.map(({ lng, lat }) => [lng, lat]);

// A part's rings: its exterior, then its holes
const toRings = (part: PolygonPart) =>
  [part.exterior, ...part.holes].map(toPositions);

/**
 * A farm's geometry as GeoJSON: a Point, a Polygon for a farm of one part and a
 * MultiPolygon for a farm of several, with the holes as inner rings.
 */
export const getFarmGeoJsonGeometry = (
  farm: FarmData
): GeoJsonFeature["geometry"] => {
  if (farm.polygon.type === "point") {
    const { lng, lat } = farm.polygon.details.center;
    return { type: "Point", coordinates: [lng, lat] };
  }
  const parts = farm.polygon.details?.parts ?? [];
  if (parts.length > 1) {
    return { type: "MultiPolygon", coordinates: parts.map(toRings) };
  }
  return { type: "Polygon", coordinates: parts.length ? toRings(parts[0]) : [[]] };
};

export const generateGeoJsonFeature = (farm: FarmData): GeoJsonFeature => {
  return {
    type: "Feature",
    properties: {
      ...getRowCommonDataAsObject(farm),
    },
    geometry: getFarmGeoJsonGeometry(farm),
  };
};

export const generateGeoJsonFarmsDataWithPolygonsValidation = (
  farmsData: FarmData[],
  polygonsValidationResults: ValidateFarmsResponse
) => {
  const geoJsonData: GeoJsonData = {
    type: "FeatureCollection",
    features: farmsData.map((farm) => {
      const feature = generateGeoJsonFeature(farm);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status:
            polygonsValidationResults?.farmResults.find(
              (f) => f.farmId === farm.id
            )?.status || "",
        },
      };
    }),
  };
  return geoJsonData;
};

export const generateGeoJsonFarmsDataWithDeforestationAnalysis = (
  farmsData: FarmData[],
  deforestationAnalysisResults: Pick<
    DeforestationAnalysisMapResults,
    "mapId" | "farmResults"
  >[],
  availableMaps: MapData[],
  language?: string
) => {
  const geoJsonData: GeoJsonData = {
    type: "FeatureCollection",
    features: farmsData.map((farm) => {
      const feature = generateGeoJsonFeature(farm);
      return {
        ...feature,
        properties: {
          ...feature.properties,
          ...deforestationAnalysisResults.reduce(
            (acc, { mapId, farmResults }) => {
              const map = availableMaps.find((map) => map.id === mapId);
              const farmMapResult = farmResults.find(
                ({ farmId }) => farmId === farm.id
              );
              if (!map || !farmMapResult) return acc;
              return {
                ...acc,
                [`Deforestation according to ${layerLabel(map, "short")}`]:
                  !farmMapResult || farmMapResult.value === null
                    ? "N/A"
                    : formatDeforestationPercentage(
                        farmMapResult.value,
                        language
                      ),
              };
            },
            {}
          ),
        },
      };
    }),
  };
  return geoJsonData;
};
