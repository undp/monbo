"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UploadPageContent } from "@/components/page/uploadData/UploadPageContent";
import {
  readExcel,
  getSheetDataById,
  sheetToJson,
  removeFirstNRow,
} from "@/utils/excel";
import { WorkSheet } from "xlsx";
import { generateFarmsData, validatePolygons } from "@/api/polygonValidation";
import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { DownloadTemplateStep } from "@/components/page/uploadData/DownloadTemplateStep";
import { UploadFileStep } from "@/components/page/uploadData/UploadFileStep";
import { useTranslation } from "react-i18next";
import { StepContainer } from "@/components/page/uploadData/StepContainer";
import { validateData } from "@/utils/modules";
import { FarmData } from "@/interfaces/Farm";
import { sum } from "lodash";

const parseExcelData = (worksheet: WorkSheet) => {
  // Check mandatory headers
  const headersData = sheetToJson(worksheet, { range: "A1:AA2", header: 1 });
  const headers = headersData[1] as string[];
  const mandatoryData = headersData[0] as string[];
  const mandatoryHeaders: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (mandatoryData[i] === "OBLIGATORIO") {
      mandatoryHeaders.push(headers[i]);
    }
  }

  // Get all data
  const dataSheet = removeFirstNRow(worksheet, 1);
  return {
    data: sheetToJson(dataSheet) as Record<string, string>[],
    headers,
    mandatoryHeaders,
  };
};

const keyMapping: Record<string, string> = {
  ID: "id",
  "Nombre productor": "producerName",
  "Fecha producción": "productionDate",
  "Cantidad producción": "productionQuantity",
  "Unidad cantidad producción": "productionQuantityUnit",
  País: "country",
  Región: "region",
  "Coordenadas finca": "farmCoordinates",
  "Tipo de cultivo": "cropType",
  Asociación: "association",
  "Nombre documento 1": "documentName1",
  "Link documento 1": "documentUrl1",
  "Nombre documento 2": "documentName2",
  "Link documento 2": "documentUrl2",
  "Nombre documento 3": "documentName3",
  "Link documento 3": "documentUrl3",
};

export function PolygonsValidationUploadDataPageContent() {
  const [loading, setLoading] = useState<boolean>(false);
  const { openSnackbar } = useContext(SnackbarContext);
  const { farmsData, setFarmsData, setPolygonsValidationResults } =
    useContext(DataContext);
  const router = useRouter();
  const { t } = useTranslation();
  const prevDataRef = useRef<string | null>(null);

  const performFarmsGeneration = useCallback(
    async (data: Record<string, unknown>[]) => {
      try {
        const results = await generateFarmsData(data);
        setFarmsData(results);
      } catch (error) {
        console.error(error);
        openSnackbar({
          message: t("common:snackbarAlerts:parsingFarmsDataError"),
          type: "error",
        });
        setLoading(false);
        return;
      }
    },
    [openSnackbar, setFarmsData, t]
  );

  const performValidationAnalysis = useCallback(
    async (data: FarmData[]) => {
      setLoading(true);
      try {
        const response = await validatePolygons(data);
        setPolygonsValidationResults(response);
        router.push("/polygons-validation");
        openSnackbar({
          message: t("common:snackbarAlerts:dataAnalizedSuccessfully"),
          type: "success",
        });

        const inconsistenciesCount = sum(
          response.inconsistencies.map(({ farmIds }) => farmIds.length)
        );
        if (inconsistenciesCount > 0) {
          openSnackbar({
            message: t(
              `polygonValidation:inconsistentPolygonsFound.${
                inconsistenciesCount === 1 ? "singular" : "plural"
              }`,
              { count: inconsistenciesCount }
            ),
            type: "warning",
          });
        }
      } catch (error) {
        console.error(error);
        openSnackbar({
          message: t("common:snackbarAlerts:performingAnalysisError"),
          type: "error",
        });
        setLoading(false);
      }
    },
    [setPolygonsValidationResults, router, openSnackbar, t]
  );

  useEffect(() => {
    const serializedData = JSON.stringify(farmsData?.map((d) => d.id));
    if (serializedData === prevDataRef.current) return;

    prevDataRef.current = serializedData;
    if (!farmsData) return;

    performValidationAnalysis(farmsData);
  }, [farmsData, performValidationAnalysis]);

  const onFileDropped = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      const excel = await readExcel(file);
      const worksheet = getSheetDataById(excel, 0);
      const { data, headers, mandatoryHeaders } = parseExcelData(worksheet);

      try {
        validateData({ data, headers, mandatoryHeaders, t });
      } catch (error) {
        const errorCode = (error as Error).message;
        console.error(error);
        openSnackbar({
          message: errorCode,
          type: "error",
        });
        return;
      }

      setLoading(true);
      const remappedData = data.map((row) => {
        const newRow: Record<string, unknown> & {
          documents?: Array<{ name: string; url: string }>;
          documentName1?: string;
          documentUrl1?: string;
          documentName2?: string;
          documentUrl2?: string;
          documentName3?: string;
          documentUrl3?: string;
        } = {};
        for (const [key, value] of Object.entries(row)) {
          const trimmedValue = typeof value === "string" ? value.trim() : value;
          newRow[keyMapping[key]] = trimmedValue;
        }
        return newRow;
      });

      remappedData.forEach((row) => {
        if (typeof row.id === "number") {
          row.id = row.id.toString();
        }
        if (row.productionDate instanceof Date) {
          row.productionDate = row.productionDate.toISOString();
        }
        row.documents = [];
        if (row.documentUrl1) {
          row.documents.push({
            name: row.documentName1 ?? "",
            url: row.documentUrl1,
          });
        }
        if (row.documentUrl2) {
          row.documents.push({
            name: row.documentName2 ?? "",
            url: row.documentUrl2,
          });
        }
        if (row.documentUrl3) {
          row.documents.push({
            name: row.documentName3 ?? "",
            url: row.documentUrl3,
          });
        }
        delete row.documentName1;
        delete row.documentUrl1;
        delete row.documentName2;
        delete row.documentUrl2;
        delete row.documentName3;
        delete row.documentUrl3;
      });

      performFarmsGeneration(remappedData);
    },
    [performFarmsGeneration, openSnackbar, t]
  );

  if (loading)
    return (
      <LoadingScreen text={t("polygonValidation:uploadDataPage:loadingText")} />
    );

  return (
    <UploadPageContent title={t("polygonValidation:uploadDataPage:title")}>
      <StepContainer
        title={t("polygonValidation:uploadDataPage:templateStep:stepTitle")}
      >
        <DownloadTemplateStep
          title={t("polygonValidation:uploadDataPage:templateStep:title")}
          description={t(
            "polygonValidation:uploadDataPage:templateStep:description"
          )}
          buttonText={t(
            "polygonValidation:uploadDataPage:templateStep:buttonText"
          )}
          fileUrl="/files/polygon-validation-template.xlsx"
        />
      </StepContainer>
      <StepContainer
        title={t("polygonValidation:uploadDataPage:uploadStep:stepTitle")}
        sx={{ flexGrow: 1 }}
      >
        <UploadFileStep
          texts={{
            inactiveDragzoneCallToAction: t(
              "polygonValidation:uploadDataPage:uploadStep:inactiveDragzoneCallToAction"
            ),
            activeDragzoneCallToAction: t(
              "polygonValidation:uploadDataPage:uploadStep:activeDragzoneCallToAction"
            ),
            buttonText: t(
              "polygonValidation:uploadDataPage:uploadStep:dragzoneButtonText"
            ),
            text: t("polygonValidation:uploadDataPage:uploadStep:dragzoneText"),
          }}
          fileAccept={{
            "application/vnd.ms-excel": [".xls"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
              [".xlsx"],
          }}
          onDrop={onFileDropped}
        />
      </StepContainer>
    </UploadPageContent>
  );
}
