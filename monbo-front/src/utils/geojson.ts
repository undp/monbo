import { FarmData } from "@/interfaces/Farm";
import { GeoJsonData, GeoJsonFeature } from "@/hooks/useGeoJsonDownload";
import { getRowCommonDataAsObject } from "./download";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { formatDeforestationPercentage } from "./numbers";

export const generateGeoJsonFeature = (farm: FarmData): GeoJsonFeature => {
  return {
    type: "Feature",
    properties: {
      ...getRowCommonDataAsObject(farm),
    },
    geometry: {
      type: farm.polygon.type === "point" ? "Point" : "Polygon",
      coordinates:
        farm.polygon.type === "point"
          ? [farm.polygon.details.center.lng, farm.polygon.details.center.lat]
          : [farm.polygon.details.path.map(({ lng, lat }) => [lng, lat])],
    },
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
  deforestationAnalysisResults: DeforestationAnalysisMapResults[],
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
                [`Deforestation according to ${map.alias}`]:
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
