"use client";

import { DownloadButton } from "@/components/reusable/DownloadButton";
import { DataContext } from "@/context/DataContext";
import { useCallback, useContext } from "react";
import {
  FarmTooLargeForExcelError,
  buildPolygonValidationSheets,
} from "@/utils/resultsExport";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useExcelDownload } from "@/hooks/useExcelDownload";
import { GeoJsonData, useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useTranslation } from "react-i18next";
import { generateGeoJsonFarmsDataWithPolygonsValidation } from "@/utils/geojson";

export const DownloadPageData = () => {
  const { farmsData, polygonsValidationResults } = useContext(DataContext);
  const { farmsData: validFarmsData } = useValidFarmsDataForValidationPage();
  const { openSnackbar } = useContext(SnackbarContext);
  const downloadAsExcel = useExcelDownload();
  const downloadAsGeoJson = useGeoJsonDownload();
  const { t, i18n } = useTranslation(["common"]);

  const isDisabled =
    !farmsData || !validFarmsData || !polygonsValidationResults;

  const onDownloadAsExcelClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      const parsedData = await buildPolygonValidationSheets(
        farmsData,
        validFarmsData,
        polygonsValidationResults?.inconsistencies ?? [],
        polygonsValidationResults?.farmResults ?? [],
        t,
        i18n.language
      );
      downloadAsExcel(parsedData, "step1-results.xlsx");
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
      const geoJsonData: GeoJsonData =
        generateGeoJsonFarmsDataWithPolygonsValidation(
          farmsData,
          polygonsValidationResults
        );
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
