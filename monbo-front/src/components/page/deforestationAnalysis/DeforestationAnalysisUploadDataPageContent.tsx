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
import { MultiSelector } from "@/components/reusable/selectors/MultiSelector";
import { Box } from "@mui/material";
import { CustomHeaderStepContainer } from "@/components/page/uploadData/CustomHeaderStepContainer";
import { useCountryAndMapsSelection } from "@/hooks/useCountryAndMapsSelection";
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
    analysisOutdated,
    setAnalysisOutdated,
  } = useContext(DataContext);
  const { t, i18n } = useTranslation();
  // With farms already loaded the analysis starts right away, unless no map is
  // selected yet: then the form is shown so the user can pick one.
  const [loading, setLoading] = useState(
    () => !!farmsData && selectedMapsForDeforestation.length > 0
  );
  const prevDataRef = useRef<string | null>(null);
  // Only the latest analysis request may store its results.
  const latestRequestRef = useRef(0);

  const onCountrySelectionChangeEffect = useCallback(() => {
    // When the user selects a country, we need to clear the selected maps
    setDeforestationAnalysisParams((prev) => ({
      ...prev,
      selectedMaps: [],
    }));
  }, [setDeforestationAnalysisParams]);

  const {
    selectedCountries,
    countriesOptions,
    onCountrySelectionChange,
    mapOptions,
    selectedMapsOptions,
  } = useCountryAndMapsSelection({
    selectedMaps: selectedMapsForDeforestation,
    availableMaps,
    onCountrySelectionChangeEffect,
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
        const results = await generateFarmsData(data, i18n.language);
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
    [openSnackbar, setFarmsData, t, i18n.language]
  );

  const performDeforestationAnalysis = useCallback(
    async (data: FarmData[]) => {
      const request = ++latestRequestRef.current;
      setLoading(true);
      try {
        const response = await analizeDeforestation(
          data,
          selectedMapsForDeforestation
        );
        // A newer request (e.g. after a layer changed again) supersedes this one.
        if (request !== latestRequestRef.current) return;
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
        if (request !== latestRequestRef.current) return;
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
      // Only an analysis invalidated by a layer change re-runs when the selected
      // layers' calculation inputs change; ticking maps on the form doesn't.
      calculationInputs: analysisOutdated
        ? selectedMapsForDeforestation.map((map) => [
            map.id,
            map.version,
            map.pixelSize,
            map.baseline,
            map.comparedAgainst,
          ])
        : null,
    });
    if (serializedData === prevDataRef.current) return;

    prevDataRef.current = serializedData;
    if (!farmsData || !selectedMapsForDeforestation.length) return;

    performDeforestationAnalysis(farmsData);
  }, [
    farmsData,
    selectedMapsForDeforestation,
    analysisOutdated,
    performDeforestationAnalysis,
  ]);

  const onFileDropped = useCallback(
    async (acceptedFiles: File[]) => {
      // A new file is a new analysis, not a recalculation of an outdated one.
      setAnalysisOutdated(false);
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
    [openSnackbar, t, performFarmsGeneration, setAnalysisOutdated, i18n.language]
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
      <CustomHeaderStepContainer
        header={
          <Box
            sx={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Text variant="h4" bold>
              {t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:stepTitle"
              )}
            </Text>
            <MultiSelector
              sx={{ width: 350 }}
              selectedOptions={selectedCountries}
              options={countriesOptions}
              label={t(
                "deforestationAnalysis:uploadDataPage:mapSelectionStep:countrySelectorLabel"
              )}
              onChange={onCountrySelectionChange}
              compact
            />
          </Box>
        }
      >
        <MultiSelectionStep
          selectedOptions={selectedMapsOptions}
          options={mapOptions}
          onChange={onMapSelectionChange}
        />
        {!selectedCountries.length && (
          <MessageBox
            message={t(
              "deforestationAnalysis:uploadDataPage:mapSelectionStep:noCountriesSelected"
            )}
          />
        )}
        {selectedCountries.length > 0 && !mapOptions.length && (
          <MessageBox
            message={t(
              "deforestationAnalysis:uploadDataPage:mapSelectionStep:noMapsAvailable"
            )}
          />
        )}
      </CustomHeaderStepContainer>
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
