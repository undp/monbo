"use client";

import { DownloadButton } from "@/components/reusable/DownloadButton";
import { useCallback, useContext } from "react";
import {
  FarmTooLargeForExcelError,
  buildDeforestationSheets,
} from "@/utils/resultsExport";
import { useVisibleDataForDeforestationPage } from "@/hooks/useVisibleDataForDeforestationPage";
import { DataContext } from "@/context/DataContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useExcelDownload } from "@/hooks/useExcelDownload";
import { GeoJsonData, useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useTranslation } from "react-i18next";
import { generateGeoJsonFarmsDataWithDeforestationAnalysis } from "@/utils/geojson";

export const DownloadPageData = () => {
  const { farmsData, deforestationAnalysisResults } =
    useVisibleDataForDeforestationPage();
  // The analysed layers, not today's catalog: a layer whose category was disabled
  // after the analysis leaves GET /maps, but its results stay, with "No data".
  const {
    deforestationAnalysisParams: { selectedMaps },
    availableCategories,
  } = useContext(DataContext);
  const { openSnackbar } = useContext(SnackbarContext);
  const downloadAsExcel = useExcelDownload();
  const downloadAsGeoJson = useGeoJsonDownload();
  const { t, i18n } = useTranslation(["common"]);

  const isDisabled = !farmsData || !deforestationAnalysisResults;

  const onDownloadAsExcelClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      const parsedData = await buildDeforestationSheets(
        farmsData,
        deforestationAnalysisResults,
        selectedMaps,
        availableCategories,
        t,
        i18n.language
      );
      downloadAsExcel(parsedData, "step2-results.xlsx");
    } catch (error) {
      console.error("Error generating Excel:", error);
      openSnackbar({
        message:
          error instanceof FarmTooLargeForExcelError
            ? t("common:snackbarAlerts:farmTooLargeForExcel", {
                id: error.farmId,
              })
            : t("common:snackbarAlerts:errorParsingDataForExcel"),
        type: "error",
      });
    }
  }, [
    farmsData,
    deforestationAnalysisResults,
    selectedMaps,
    availableCategories,
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
          selectedMaps,
          availableCategories,
          t,
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
    selectedMaps,
    availableCategories,
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
