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
import { getRowCommonDataAsArray } from "@/utils/download";
import { useValidFarmsDataForValidationPage } from "@/hooks/useValidFarmsDataForValidationPage";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useExcelDownload } from "@/hooks/useExcelDownload";
import { GeoJsonData, useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useTranslation } from "react-i18next";
import { generateGeoJsonFarmsDataWithPolygonsValidation } from "@/utils/geojson";
import * as XLSX from "xlsx";

const loadTemplateHeaders = async (): Promise<string[][]> => {
  // Path to your template in the public directory
  const templatePath = "/files/polygon-validation-template.xlsx";

  // Fetch the template file
  const response = await fetch(templatePath);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }

  const templateArrayBuffer = await response.arrayBuffer();

  // Load the template workbook
  const templateWorkbook = XLSX.read(templateArrayBuffer, { type: "array" });

  // Get the first sheet name
  const firstSheetName = templateWorkbook.SheetNames[0];

  // Get the first worksheet
  const templateSheet = templateWorkbook.Sheets[firstSheetName];

  // Convert to JSON to easily extract header rows
  const templateData: string[][] = XLSX.utils.sheet_to_json(templateSheet, {
    header: 1,
  });

  // Extract the first 3 rows (headers)
  const headerRows = templateData.slice(0, 3);

  return headerRows;
};

const parseData = async (
  farmsData: FarmData[],
  validFarmsData: FarmData[],
  inconsistencies: InconsistentPolygonData[],
  farmsStatus: ValidateFarmsResponse["farmResults"],
  language: string
): Promise<Record<string, SheetData>> => {
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

  const headersRows = await loadTemplateHeaders();

  const validPolygonsHeaders: (string | XLSX.CellObject)[][] = [[], [], []];
  validPolygonsHeaders[0].push(...headersRows[0]);
  validPolygonsHeaders[1].push(
    ...headersRows[1],
    "Resultado Validación\nValidation Result"
  );
  validPolygonsHeaders[2].push(...headersRows[2], "VALID");

  const inconsistenciesHeaders: (string | XLSX.CellObject)[][] = [[], [], []];
  inconsistenciesHeaders[0].push(...headersRows[0]);
  inconsistenciesHeaders[1].push(
    ...headersRows[1],
    "Porcentaje de Traslape\nOverlap Percentage"
  );
  inconsistenciesHeaders[2].push(...headersRows[2], "5%");

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
        i18n.language
      );
      console.log(parsedData);
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
