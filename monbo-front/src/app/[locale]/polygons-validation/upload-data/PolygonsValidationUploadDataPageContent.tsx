"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UploadPageContent } from "@/components/page/uploadData/UploadPageContent";
import { generateFarmsData } from "@/api/farms";
import { validatePolygons } from "@/api/polygonValidation";
import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { DownloadTemplateStep } from "@/components/page/uploadData/DownloadTemplateStep";
import { UploadFileStep } from "@/components/page/uploadData/UploadFileStep";
import { useTranslation } from "react-i18next";
import { TextHeaderStepContainer } from "@/components/page/uploadData/TextHeaderStepContainer";
import { FarmData } from "@/interfaces/Farm";
import { sum } from "lodash";
import { loadExcelFileFarmsData } from "@/utils/excel";

export function PolygonsValidationUploadDataPageContent() {
  const [loading, setLoading] = useState<boolean>(false);
  const { openSnackbar } = useContext(SnackbarContext);
  const { farmsData, setFarmsData, setPolygonsValidationResults } =
    useContext(DataContext);
  const router = useRouter();
  const { t, i18n } = useTranslation();
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
      setLoading(true);

      const file = acceptedFiles[0];
      const { data, errorMessages } = await loadExcelFileFarmsData(
        file,
        t,
        i18n.language
      );

      if (errorMessages.length > 0) {
        for (const errorMessage of errorMessages) {
          openSnackbar({
            message: errorMessage,
            type: "error",
          });
        }
        setLoading(false);
        return;
      } else {
        performFarmsGeneration(data);
      }
    },
    [performFarmsGeneration, openSnackbar, t, i18n.language]
  );

  if (loading)
    return (
      <LoadingScreen text={t("polygonValidation:uploadDataPage:loadingText")} />
    );

  return (
    <UploadPageContent title={t("polygonValidation:uploadDataPage:title")}>
      <TextHeaderStepContainer
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
      </TextHeaderStepContainer>
      <TextHeaderStepContainer
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
      </TextHeaderStepContainer>
    </UploadPageContent>
  );
}
