"use client";

import { DownloadButton } from "@/components/reusable/DownloadButton";
import { FarmData } from "@/interfaces/Farm";
import { SheetData } from "@/utils/excel";
import { useCallback, useContext } from "react";
import { formatDeforestationPercentage } from "@/utils/numbers";
import {
  COMMON_HEADERS,
  MANDATORY_HEADERS,
  getRowCommonDataAsArray,
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
import { generateGeoJsonFarmsDataWithDeforestationAnalysis } from "@/utils/geojson";

const parseData = (
  farmsData: FarmData[],
  deforestationAnalysisResults: DeforestationAnalysisMapResults[],
  availableMaps: MapData[],
  language: string
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
        return formatDeforestationPercentage(farmMapResult.value, language);
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
  const { t, i18n } = useTranslation(["common"]);

  const isDisabled = !farmsData || !deforestationAnalysisResults;

  const onDownloadAsExcelClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      const parsedData = parseData(
        farmsData,
        deforestationAnalysisResults,
        availableMaps,
        i18n.language
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
    i18n.language,
  ]);

  const onDownloadAsGeoJsonClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      const geoJsonData: GeoJsonData =
        generateGeoJsonFarmsDataWithDeforestationAnalysis(
          farmsData,
          deforestationAnalysisResults,
          availableMaps,
          i18n.language
        );
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
    i18n.language,
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
