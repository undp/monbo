"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { UploadPageContent } from "@/components/page/uploadData/UploadPageContent";
import { Text } from "@/components/reusable/Text";
import { generateFarmsData } from "@/api/farms";
import { analizeDeforestation } from "@/api/deforestationAnalysis";
import { DataContext } from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { DownloadTemplateStep } from "@/components/page/uploadData/DownloadTemplateStep";
import { UploadFileStep } from "@/components/page/uploadData/UploadFileStep";
import { TextHeaderStepContainer } from "@/components/page/uploadData/TextHeaderStepContainer";
import { useTranslation } from "react-i18next";
import { FarmData } from "@/interfaces/Farm";
import { MultiSelectionStep } from "@/components/page/uploadData/MultiSelectionStep";
import { useMapsForSelectedCountry } from "@/hooks/useMapsForSelectedCountry";
import { MessageBox } from "@/components/reusable/MessageBox";
import {
  getUploadFileTemplatePath,
  loadExcelFileFarmsData,
} from "@/utils/excel";

export function DeforestationAnalysisUploadDataPageContent() {
  // const [file, setFile] = useState<File | null>(null);
  const { openSnackbar } = useContext(SnackbarContext);
  const router = useRouter();
  const {
    availableMaps,
    farmsData,
    setFarmsData,
    deforestationAnalysisParams: { selectedMaps: selectedMapsForDeforestation },
    setDeforestationAnalysisParams,
    setDeforestationAnalysisResults,
    selectedCountry,
    analysisOutdated,
    setAnalysisOutdated,
  } = useContext(DataContext);
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(() => !!farmsData);
  const prevDataRef = useRef<string | null>(null);

  const { mapOptions, selectedMapsOptions } = useMapsForSelectedCountry({
    selectedMaps: selectedMapsForDeforestation,
    availableMaps,
  });

  const onMapSelectionChange = useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: [
            ...prev.selectedMaps,
            availableMaps.find((m) => m.id === Number(id))!,
          ],
        }));
      } else {
        setDeforestationAnalysisParams((prev) => ({
          ...prev,
          selectedMaps: prev.selectedMaps.filter((m) => m.id !== Number(id)),
        }));
      }
    },
    [availableMaps, setDeforestationAnalysisParams]
  );

  const performFarmsGeneration = useCallback(
    async (data: Record<string, unknown>[]) => {
      try {
        // The upload has no country column: every farm is in the analysis country.
        const results = await generateFarmsData(
          data.map((row) => ({ ...row, country: selectedCountry })),
          i18n.language
        );
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
    [openSnackbar, setFarmsData, t, i18n.language, selectedCountry]
  );

  const performDeforestationAnalysis = useCallback(
    async (data: FarmData[]) => {
      setLoading(true);
      try {
        const response = await analizeDeforestation(
          data,
          selectedMapsForDeforestation
        );
        setDeforestationAnalysisResults(response);
        setAnalysisOutdated(false);
        router.push(`/${i18n.language}/deforestation-analysis`);
        openSnackbar({
          message: analysisOutdated
            ? t("deforestationAnalysis:uploadDataPage:analysisUpdated")
            : t("common:snackbarAlerts:dataAnalizedSuccessfully"),
          type: "success",
        });
      } catch {
        openSnackbar({
          message: t("common:snackbarAlerts:performingAnalysisError"),
          type: "error",
        });
        // TODO: we should navigate back to polygons validation page only if coming from there
        // router.push("/polygons-validation");
        setLoading(false);
      }
    },
    [
      selectedMapsForDeforestation,
      router,
      setDeforestationAnalysisResults,
      setAnalysisOutdated,
      analysisOutdated,
      openSnackbar,
      t,
      i18n.language,
    ]
  );

  useEffect(() => {
    const serializedData = JSON.stringify({
      farms: farmsData?.map((farm) => farm.id),
      calculationInputs: selectedMapsForDeforestation.map((map) => [
        map.id,
        map.version,
        map.pixelSize,
        map.baseline,
        map.comparedAgainst,
      ]),
    });
    if (serializedData === prevDataRef.current) return;

    prevDataRef.current = serializedData;
    if (!farmsData) return;

    performDeforestationAnalysis(farmsData);
  }, [farmsData, selectedMapsForDeforestation, performDeforestationAnalysis]);

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
    [openSnackbar, t, performFarmsGeneration, i18n.language]
  );

  if (loading)
    return (
      <LoadingScreen
        text={t(
          analysisOutdated
            ? "deforestationAnalysis:uploadDataPage:recalculatingText"
            : "deforestationAnalysis:uploadDataPage:loadingText"
        )}
      />
    );

  return (
    <UploadPageContent title={t("deforestationAnalysis:uploadDataPage:title")}>
      <TextHeaderStepContainer
        title={t("deforestationAnalysis:uploadDataPage:templateStep:stepTitle")}
      >
        <DownloadTemplateStep
          title={t("deforestationAnalysis:uploadDataPage:templateStep:title")}
          description={t(
            "deforestationAnalysis:uploadDataPage:templateStep:description"
          )}
          buttonText={t(
            "deforestationAnalysis:uploadDataPage:templateStep:buttonText"
          )}
          fileUrl={getUploadFileTemplatePath(i18n.language)} // TODO: Change to deforestation analysis template
        />
      </TextHeaderStepContainer>
      <TextHeaderStepContainer
        title={t(
          "deforestationAnalysis:uploadDataPage:mapSelectionStep:stepTitle"
        )}
      >
        <MultiSelectionStep
          selectedOptions={selectedMapsOptions}
          options={mapOptions}
          onChange={onMapSelectionChange}
        />
        {!mapOptions.length && (
          <MessageBox
            message={t(
              "deforestationAnalysis:uploadDataPage:mapSelectionStep:noMapsAvailable"
            )}
          />
        )}
      </TextHeaderStepContainer>
      <TextHeaderStepContainer
        title={t("deforestationAnalysis:uploadDataPage:uploadStep:stepTitle")}
        sx={{
          flexGrow: 1,
          opacity: selectedMapsForDeforestation.length === 0 ? 0.4 : 1,
        }}
      >
        <UploadFileStep
          texts={{
            inactiveDragzoneCallToAction: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:inactiveDragzoneCallToAction"
            ),
            activeDragzoneCallToAction: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:activeDragzoneCallToAction"
            ),
            buttonText: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:dragzoneButtonText"
            ),
            text: t(
              "deforestationAnalysis:uploadDataPage:uploadStep:dragzoneText"
            ),
          }}
          fileAccept={{
            "application/vnd.ms-excel": [".xls"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
              [".xlsx"],
          }}
          onDrop={onFileDropped}
          disabled={selectedMapsForDeforestation.length === 0}
        />
      </TextHeaderStepContainer>
    </UploadPageContent>
  );
}
