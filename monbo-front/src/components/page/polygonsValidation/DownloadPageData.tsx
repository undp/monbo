"use client";

import { DownloadButton } from "@/components/reusable/DownloadButton";
import { DataContext } from "@/context/DataContext";
import {
  InconsistentPolygonData,
  ValidateFarmsResponse,
} from "@/interfaces/PolygonValidation";
import { FarmData } from "@/interfaces/Farm";
import { SheetData, loadTemplateHeaders } from "@/utils/excel";
import { useCallback, useContext } from "react";
import { flatten } from "lodash";
import { formatOverlapPercentage } from "@/utils/numbers";
import { getRowCommonDataAsArray } from "@/utils/download";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useExcelDownload } from "@/hooks/useExcelDownload";
import { GeoJsonData, useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useTranslation } from "react-i18next";
import { generateGeoJsonFarmsDataWithPolygonsValidation } from "@/utils/geojson";
import * as XLSX from "xlsx";
import { TFunction } from "i18next";

const parseData = async (
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
    return [...getRowCommonDataAsArray(farm, language), farmStatus];
  });
  const percentagesMerges: SheetData["merges"] = [];
  const inconsistenciesParsedData = flatten(
    inconsistencies.map((item, idx) => {
      let rowNumber = 3;
      for (let i = 0; i < idx; i++) {
        rowNumber += inconsistencies[i].farmIds.length;
      }

      percentagesMerges.push({
        s: { r: rowNumber, c: 17 },
        e: { r: rowNumber + item.farmIds.length - 1, c: 17 },
      });
      return item.farmIds.map((farmId) => {
        const farm = farmsData.find((farm) => farm.id === farmId)!;
        return [
          ...getRowCommonDataAsArray(farm, language),
          t(`polygonValidation:inconsistenciesTypes:${item.type}`),
          item.type === "overlap"
            ? formatOverlapPercentage(item.data.percentage, language)
            : "",
        ];
      });
    })
  );

  const templateHeadersRows = await loadTemplateHeaders(language);

  const validPolygonsHeaders: (string | XLSX.CellObject)[][] = [[], [], []];
  validPolygonsHeaders[0].push(...templateHeadersRows[0]);
  validPolygonsHeaders[1].push(
    ...templateHeadersRows[1],
    "Resultado Validación\nValidation Result"
  );
  validPolygonsHeaders[2].push(...templateHeadersRows[2], "VALID");

  const inconsistenciesHeaders: (string | XLSX.CellObject)[][] = [[], [], []];
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
    "Polígonos válidos": {
      rows: [...validPolygonsHeaders, ...validatedPolygonsParsedData],
    },
    "Polígonos inconsistentes": {
      rows: [...inconsistenciesHeaders, ...inconsistenciesParsedData],
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

  const onDownloadAsExcelClick = useCallback(async () => {
    if (isDisabled) return;

    try {
      const parsedData = await parseData(
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
