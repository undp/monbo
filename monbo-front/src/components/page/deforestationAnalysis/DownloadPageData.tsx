"use client";

import { DownloadButton } from "@/components/reusable/DownloadButton";
import { FarmData } from "@/interfaces/Farm";
import { SheetData } from "@/utils/excel";
import { useCallback, useContext } from "react";
import { formatPercentage } from "@/utils/numbers";
import {
  COMMON_HEADERS,
  MANDATORY_HEADERS,
  getRowCommonDataAsArray,
  getRowCommonDataAsObject,
} from "@/utils/download";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import {
  DeforestationAnalysisMapResults,
  MapData,
} from "@/interfaces/DeforestationAnalysis";
import { DataContext } from "@/context/DataContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useExcelDownload } from "@/hooks/useExcelDownload";
import { GeoJsonData, useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useTranslation } from "react-i18next";

const parseData = (
  farmsData: FarmData[],
  deforestationAnalysisResults: DeforestationAnalysisMapResults[],
  availableMaps: MapData[]
): Record<string, SheetData> => {
  const mapsHeaders = deforestationAnalysisResults.map(({ mapId }) => {
    const map = availableMaps.find((map) => map.id === mapId);
    return `Deforestación según ${map?.alias ?? ""}`;
  });
  const allAttributesHeaders = [...COMMON_HEADERS, ...mapsHeaders];

  const polygonsParsedData = farmsData.map((farm) => {
    const deforestationPercentages = deforestationAnalysisResults.map(
      ({ farmResults }) => {
        const farmMapResult = farmResults.find(
          ({ farmId }) => farmId === farm.id
        );
        if (!farmMapResult || farmMapResult.value === null) return "N/D";
        return formatPercentage(farmMapResult.value, 1);
      }
    );
    return [...getRowCommonDataAsArray(farm), ...deforestationPercentages];
  });

  return {
    "Resultados de deforestación": {
      rows: [MANDATORY_HEADERS, allAttributesHeaders, ...polygonsParsedData],
    },
  };
};

export const DownloadPageData = () => {
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();
  const { availableMaps } = useContext(DataContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const downloadAsExcel = useExcelDownload();
  const downloadAsGeoJson = useGeoJsonDownload();
  const { t } = useTranslation(["common"]);

  const isDisabled = !farmsData || !deforestationAnalysisResults;

  const onDownloadAsExcelClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      const parsedData = parseData(
        farmsData,
        deforestationAnalysisResults,
        availableMaps
      );
      downloadAsExcel(parsedData, "step2-results.xlsx");
    } catch (error) {
      console.error("Error generating Excel:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorParsingDataForExcel"),
        type: "error",
      });
    }
  }, [
    farmsData,
    deforestationAnalysisResults,
    availableMaps,
    isDisabled,
    openSnackbar,
    downloadAsExcel,
    t,
  ]);

  const onDownloadAsGeoJsonClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      // Convert farmsData to GeoJSON format
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
                      : formatPercentage(farmMapResult.value, 1),
                };
              },
              {}
            ),
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
      downloadAsGeoJson(geoJsonData, "step2-results.geojson");
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
    availableMaps,
    deforestationAnalysisResults,
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
