import { flatten } from "lodash";
import { TFunction } from "i18next";
import { FarmData } from "@/interfaces/Farm";
import {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import {
  LayerAnalysisMapResults,
  MapData,
} from "@/interfaces/LayerAnalysis";
import type { LayerCategory } from "@/interfaces/LayerCategory";
import { areaHectares } from "./download";
import { calendarDay } from "./dates";
import { formatOverlapPercentage } from "./numbers";
import { findingPercentCell, layerResultColumns } from "./layerCategories";
import {
  SheetData,
  TEMPLATE_COLUMNS,
  TemplateColumn,
  loadTemplateHeaders,
} from "./excel";
import { getFarmGeoJsonGeometry } from "./geojson";

type Cell = SheetData["rows"][number][number];

// The most characters an Excel cell holds: a longer one would be cut
const EXCEL_CELL_MAX_LENGTH = 32767;

/** A farm whose coordinates don't fit an Excel cell: the GeoJSON export holds it. */
export class FarmTooLargeForExcelError extends Error {
  constructor(public farmId: string) {
    super(`Farm ${farmId}'s coordinates don't fit an Excel cell`);
  }
}

/**
 * The farm's geometry type and GeoJSON coordinates: `[lng, lat]` for a point, the
 * rings of a polygon, or the polygons of a farm of several parts.
 */
const getGeoJsonGeometryCells = (
  farm: FarmData
): { geometryType: string; coordinates: string } => {
  const geometry = getFarmGeoJsonGeometry(farm);
  const isEmpty =
    farm.polygon.type === "polygon" && !farm.polygon.details?.parts.length;
  const coordinates = isEmpty ? "" : JSON.stringify(geometry.coordinates);
  if (coordinates.length > EXCEL_CELL_MAX_LENGTH) {
    throw new FarmTooLargeForExcelError(farm.id);
  }
  return { geometryType: geometry.type, coordinates };
};

/**
 * A farm in the upload template's columns, so an export can be uploaded again.
 * Quantity and area are numbers, so they read the same in any language.
 */
export const farmToTemplateRow = (farm: FarmData): Cell[] => {
  const { geometryType, coordinates } = getGeoJsonGeometryCells(farm);
  const values: Record<TemplateColumn, Cell> = {
    id: farm.id,
    producerName: farm.producer,
    productionDate: farm.productionDate ? calendarDay(farm.productionDate) : "",
    productionQuantity: farm.production,
    productionQuantityUnit: farm.productionQuantityUnit || "",
    region: farm.region || "",
    coordinatesFormat: "GeoJSON",
    geometryType,
    farmCoordinates: coordinates,
    // In hectares, not rounded: an upload takes 0 as a missing area and gives
    // the point 1 ha, so a small point must keep its exact area. Empty when the
    // API could not compute it (null or -1).
    area: areaHectares(farm) ?? "",
    cropType: farm.cropType,
    association: farm.association || "",
    documentName1: farm.documents[0]?.name || "",
    documentUrl1: farm.documents[0]?.url || "",
    documentName2: farm.documents[1]?.name || "",
    documentUrl2: farm.documents[1]?.url || "",
    documentName3: farm.documents[2]?.name || "",
    documentUrl3: farm.documents[2]?.url || "",
  };
  return TEMPLATE_COLUMNS.map((column) => values[column]);
};

/**
 * The upload template's 3 header rows (headers and example row), cut to its
 * columns: the example row has a stray value past them, which would push the
 * results' headers out of line.
 */
const loadTemplateHeaderRows = async (language: string): Promise<Cell[][]> => {
  const rows = await loadTemplateHeaders(language);
  return rows.map((row) =>
    TEMPLATE_COLUMNS.map((_, idx) => row[idx] ?? "")
  );
};

export const buildPolygonValidationSheets = async (
  farmsData: FarmData[],
  validFarmsData: FarmData[],
  inconsistencies: InconsistentPolygonData[],
  farmsStatus: ValidateFarmsResponse["farmResults"],
  t: TFunction<"translation", undefined>,
  language: string
): Promise<Record<string, SheetData>> => {
  const validatedPolygonsParsedData = validFarmsData.map((farm) => {
    const farmStatus =
      farmsStatus.find((f) => f.farmId === farm.id)?.status || "";
    return [...farmToTemplateRow(farm), farmStatus];
  });
  // After the template's columns and the inconsistency type
  const percentageColumn = TEMPLATE_COLUMNS.length + 1;
  const percentagesMerges: SheetData["merges"] = [];
  const inconsistenciesParsedData = flatten(
    inconsistencies.map((item, idx) => {
      let rowNumber = 3;
      for (let i = 0; i < idx; i++) {
        rowNumber += inconsistencies[i].farmIds.length;
      }

      percentagesMerges.push({
        s: { r: rowNumber, c: percentageColumn },
        e: { r: rowNumber + item.farmIds.length - 1, c: percentageColumn },
      });
      return item.farmIds.map((farmId) => {
        const farm = farmsData.find((farm) => farm.id === farmId)!;
        return [
          ...farmToTemplateRow(farm),
          t(`polygonValidation:inconsistenciesTypes:${item.type}`),
          item.type === "overlap"
            ? formatOverlapPercentage(item.data.percentage, language)
            : "",
        ];
      });
    })
  );

  const templateHeadersRows = await loadTemplateHeaderRows(language);

  const validPolygonsHeaders: Cell[][] = [[], [], []];
  validPolygonsHeaders[0].push(...templateHeadersRows[0]);
  validPolygonsHeaders[1].push(
    ...templateHeadersRows[1],
    "Resultado Validación\nValidation Result"
  );
  validPolygonsHeaders[2].push(...templateHeadersRows[2], "VALID");

  const inconsistenciesHeaders: Cell[][] = [[], [], []];
  inconsistenciesHeaders[0].push(...templateHeadersRows[0]);
  inconsistenciesHeaders[1].push(
    ...templateHeadersRows[1],
    "Tipo de Inconsistencia\nType of Inconsistency",
    "Porcentaje de Traslape\nOverlap Percentage"
  );
  inconsistenciesHeaders[2].push(
    ...templateHeadersRows[2],
    t(`polygonValidation:inconsistenciesTypes:overlap`),
    "5%"
  );

  return {
    [t("polygonValidation:export:validSheet")]: {
      rows: [...validPolygonsHeaders, ...validatedPolygonsParsedData],
    },
    [t("polygonValidation:export:inconsistentSheet")]: {
      rows: [...inconsistenciesHeaders, ...inconsistenciesParsedData],
      merges: percentagesMerges,
    },
  };
};

/**
 * The layer analysis as one sheet: the template's columns, then two per analysed
 * layer, headed in the user's language after the category and the layer: the
 * finding, as a number in percent ("No data" as text), and the result label.
 * `availableMaps` are the analysed layers (see layerResultColumns).
 */
export const buildLayerSheets = async (
  farmsData: FarmData[],
  territorialAnalysisResults: LayerAnalysisMapResults[],
  availableMaps: MapData[],
  categories: LayerCategory[],
  t: TFunction,
  language: string
): Promise<Record<string, SheetData>> => {
  const columns = layerResultColumns(
    territorialAnalysisResults,
    availableMaps,
    categories,
    t,
    language
  );

  const polygonsParsedData = farmsData.map((farm) => [
    ...farmToTemplateRow(farm),
    ...columns.flatMap(({ result }) => {
      const farmResult = result(farm.id);
      return [findingPercentCell(farmResult), farmResult.label];
    }),
  ]);

  const templateHeadersRows = await loadTemplateHeaderRows(language);

  // All 3 rows: an upload skips them, so the first farm must start on row 4
  const resultsHeaders: Cell[][] = [[], [], []];
  resultsHeaders[0].push(...templateHeadersRows[0]);
  resultsHeaders[1].push(
    ...templateHeadersRows[1],
    ...columns.flatMap(({ findingHeader, resultHeader }) => [
      findingHeader,
      resultHeader,
    ])
  );
  resultsHeaders[2].push(...templateHeadersRows[2]);

  return {
    [t("common:layerResults:sheetName")]: {
      rows: [...resultsHeaders, ...polygonsParsedData],
    },
  };
};
