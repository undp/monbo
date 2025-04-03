import { FarmData } from "@/interfaces/Farm";
import { GeoJsonData } from "@/hooks/useGeoJsonDownload";
import { getRowCommonDataAsObject } from "./download";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { formatDeforestationPercentage } from "./numbers";

export const generateGeoJsonFarmsDataWithPolygonsValidation = (
  farmsData: FarmData[],
  polygonsValidationResults: ValidateFarmsResponse
) => {
  const geoJsonData: GeoJsonData = {
    type: "FeatureCollection",
    features: farmsData.map((farm) => ({
      type: "Feature",
      properties: {
        ...getRowCommonDataAsObject(farm),
        status:
          polygonsValidationResults?.farmResults.find(
            (f) => f.farmId === farm.id
          )?.status || "",
      },
      geometry: {
        type: farm.polygon.type === "point" ? "Point" : "Polygon",
        coordinates:
          farm.polygon.type === "point"
            ? [farm.polygon.details.center.lng, farm.polygon.details.center.lat]
            : [farm.polygon.details.path.map(({ lng, lat }) => [lng, lat])],
      },
    })),
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
    features: farmsData.map((farm) => ({
      type: "Feature",
      properties: {
        ...getRowCommonDataAsObject(farm),
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
      geometry: {
        type: farm.polygon.type === "point" ? "Point" : "Polygon",
        coordinates:
          farm.polygon.type === "point"
            ? [farm.polygon.details.center.lng, farm.polygon.details.center.lat]
            : [farm.polygon.details.path.map(({ lng, lat }) => [lng, lat])],
      },
    })),
  };
  return geoJsonData;
};
