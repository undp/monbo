import { FarmData } from "@/interfaces/Farm";
import { Coordinates, PolygonPart } from "@/interfaces/Map";
import { GeoJsonData, GeoJsonFeature } from "@/hooks/useGeoJsonDownload";
import { getRowCommonDataAsObject } from "./download";
import { ValidateFarmsResponse } from "@/interfaces/PolygonValidation";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import type { TFunction } from "i18next";
import { layerResultColumns } from "./layerCategories";

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

/**
 * The farms as GeoJSON, each with two properties per analysed layer (its finding and
 * its result, read with the layer's category), named in the user's language after
 * the category and the layer.
 */
export const generateGeoJsonFarmsDataWithDeforestationAnalysis = (
  farmsData: FarmData[],
  deforestationAnalysisResults: Pick<
    DeforestationAnalysisMapResults,
    "mapId" | "farmResults"
  >[],
  availableMaps: MapData[],
  categories: LayerCategory[],
  t: TFunction,
  language?: string
) => {
  const columns = layerResultColumns(
    deforestationAnalysisResults,
    availableMaps,
    categories,
    t,
    language
  );
  const geoJsonData: GeoJsonData = {
    type: "FeatureCollection",
    features: farmsData.map((farm) => {
      const feature = generateGeoJsonFeature(farm);
      const results: Record<string, string> = {};
      columns.forEach(({ findingHeader, resultHeader, result }) => {
        const { findingText, label } = result(farm.id);
        results[findingHeader] = findingText;
        results[resultHeader] = label;
      });
      return {
        ...feature,
        properties: { ...feature.properties, ...results },
      };
    }),
  };
  return geoJsonData;
};
