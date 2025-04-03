"use client";

import { DownloadButton } from "@/components/reusable/DownloadButton";
import { DataContext } from "@/context/DataContext";
import {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import { FarmData } from "@/interfaces/Farm";
import { SheetData } from "@/utils/excel";
import { useCallback, useContext } from "react";
import { flatten } from "lodash";
import { formatOverlapPercentage } from "@/utils/numbers";
import {
  COMMON_HEADERS,
  getRowCommonDataAsArray,
  getRowCommonDataAsObject,
  MANDATORY_HEADERS,
} from "@/utils/download";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useExcelDownload } from "@/hooks/useExcelDownload";
import { GeoJsonData, useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useTranslation } from "react-i18next";

const parseData = (
  farmsData: FarmData[],
  validFarmsData: FarmData[],
  inconsistencies: InconsistentPolygonData[],
  farmsStatus: ValidateFarmsResponse["farmResults"],
  language: string
): Record<string, SheetData> => {
  const validatedPolygonsParsedData = validFarmsData.map((farm) => {
    const farmStatus =
      farmsStatus.find((f) => f.farmId === farm.id)?.status || "";
    return [...getRowCommonDataAsArray(farm), farmStatus];
  });
  const percentagesMerges: SheetData["merges"] = [];
  const inconsistenciesParsedData = flatten(
    inconsistencies.map((item, idx) => {
      let rowNumber = 1;
      for (let i = 0; i < idx; i++) {
        rowNumber += inconsistencies[i].farmIds.length;
      }

      percentagesMerges.push({
        s: { r: rowNumber, c: 16 },
        e: { r: rowNumber + item.farmIds.length - 1, c: 16 },
      });
      return item.farmIds.map((farmId) => {
        const farm = farmsData.find((farm) => farm.id === farmId)!;
        return [
          ...getRowCommonDataAsArray(farm),
          formatOverlapPercentage(item.data.percentage, language),
        ];
      });
    })
  );

  const validPolygonsHeaders = [...COMMON_HEADERS, "Status"];
  const inconsistenciesHeaders = [...COMMON_HEADERS, "Traslape"];

  return {
    "Polígonos válidos": {
      rows: [
        MANDATORY_HEADERS,
        validPolygonsHeaders,
        ...validatedPolygonsParsedData,
      ],
    },
    "Polígonos inconsistentes": {
      rows: [inconsistenciesHeaders, ...inconsistenciesParsedData],
      merges: percentagesMerges,
    },
  };
};

export const DownloadPageData = () => {
  const { farmsData, polygonsValidationResults } = useContext(DataContext);
  const { farmsData: validFarmsData } = useValidFarmsDataForValidationPage();
  const { openSnackbar } = useContext(SnackbarContext);
  const downloadAsExcel = useExcelDownload();
  const downloadAsGeoJson = useGeoJsonDownload();
  const { t, i18n } = useTranslation(["common"]);

  const isDisabled =
    !farmsData || !validFarmsData || !polygonsValidationResults;

  const onDownloadAsExcelClick = useCallback(() => {
    if (isDisabled) return;

    try {
      const parsedData = parseData(
        farmsData,
        validFarmsData,
        polygonsValidationResults?.inconsistencies ?? [],
        polygonsValidationResults?.farmResults ?? [],
        i18n.language
      );
      downloadAsExcel(parsedData, "step1-results.xlsx");
    } catch (error) {
      console.error("Error generating Excel:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorParsingDataForExcel"),
        type: "error",
      });
    }
  }, [
    farmsData,
    validFarmsData,
    polygonsValidationResults,
    isDisabled,
    openSnackbar,
    downloadAsExcel,
    t,
    i18n.language,
  ]);

  const onDownloadAsGeoJsonClick = useCallback(async () => {
    if (isDisabled) return;
    try {
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
                ? [
                    farm.polygon.details.center.lng,
                    farm.polygon.details.center.lat,
                  ]
                : [farm.polygon.details.path.map(({ lng, lat }) => [lng, lat])],
          },
        })),
      };
      downloadAsGeoJson(geoJsonData, "step1-results.geojson");
    } catch (error) {
      console.error("Error generating GeoJSON:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorParsingDataForGeoJson"),
        type: "error",
      });
    }
  }, [
    isDisabled,
    farmsData,
    openSnackbar,
    polygonsValidationResults,
    downloadAsGeoJson,
    t,
  ]);

  return (
    <DownloadButton
      options={[
        {
          label: "Excel",
          onClick: onDownloadAsExcelClick,
          disabled: isDisabled,
        },
        {
          label: "GeoJSON",
          onClick: onDownloadAsGeoJsonClick,
          disabled: isDisabled,
        },
      ]}
    />
  );
};
