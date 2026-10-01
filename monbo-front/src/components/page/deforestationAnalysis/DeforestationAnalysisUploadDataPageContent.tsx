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
import { analizeDeforestation } from "@/api/deforestationAnalysis";
import {
  DataContext,
  readFlowGeneration,
  readSelectedCountry,
} from "@/context/DataContext";
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
import { Box, Button } from "@mui/material";
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
  // With farms already loaded the analysis starts right away, unless no map is
  // selected yet: then the form is shown so the user can pick one.
  const [loading, setLoading] = useState(
    () => !!farmsData && selectedMapsForDeforestation.length > 0
  );
  // Whether the analysis may start: when the page opens with farms and layers
  // (from the deforestation modal, or to recalculate an outdated analysis),
  // after a file is parsed, or from the "Analyze" button. Choosing layers on
  // the form never starts it, so the user can tick more than one.
  const [analysisRequested, setAnalysisRequested] = useState(
    () => !!farmsData && selectedMapsForDeforestation.length > 0
  );
  // The inputs of the latest analysis request, and whether the page is mounted:
  // a request only stores its results while both still hold.
  const prevDataRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { mapOptions, selectedMapsOptions } = useMapsForSelectedCountry({
    selectedMaps: selectedMapsForDeforestation,
    availableMaps,
  });

  const onMapSelectionChange = useCallback(
    (id: string, checked: boolean) => {
      setAnalysisRequested(false);
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
      const generation = readFlowGeneration();
      try {
        // The upload has no country column: every farm is in the analysis country.
        const results = await generateFarmsData(
          data.map((row) => ({ ...row, country: selectedCountry })),
          i18n.language
        );
        // Started over or left meanwhile: don't bring the farms back.
        if (!mountedRef.current || readFlowGeneration() !== generation) return;
        // The country can change while the parser request is in flight.
        setFarmsData(
          results.map((farm) => ({
            ...farm,
            country: readSelectedCountry() ?? farm.country,
          }))
        );
        setAnalysisRequested(true);
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
    async (data: FarmData[], isCurrent: () => boolean) => {
      setLoading(true);
      try {
        const response = await analizeDeforestation(
          data,
          selectedMapsForDeforestation
        );
        // A newer request (another country, or a layer that changed again)
        // supersedes this one.
        if (!isCurrent()) return;
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
        if (!isCurrent()) return;
        openSnackbar({
          message: t("common:snackbarAlerts:performingAnalysisError"),
          type: "error",
        });
        // TODO: we should navigate back to polygons validation page only if coming from there
        // router.push("/polygons-validation");
        setLoading(false);
        // Back to the form: the "Analyze" button retries.
        setAnalysisRequested(false);
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
    if (
      !analysisRequested ||
      !farmsData ||
      !selectedMapsForDeforestation.length
    ) {
      prevDataRef.current = null;
      return;
    }

    const serializedData = JSON.stringify({
      country: selectedCountry,
      farms: farmsData.map((farm) => [farm.id, farm.country]),
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
    // Superseded once the inputs change (prevDataRef moves on), the country
    // changes or the page unmounts. A re-run with the same inputs (e.g. the maps
    // list refreshed, or Strict Mode replaying the effect) keeps it current.
    void performDeforestationAnalysis(
      farmsData,
      () =>
        mountedRef.current &&
        prevDataRef.current === serializedData &&
        readSelectedCountry() === selectedCountry
    );
  }, [
    analysisRequested,
    farmsData,
    selectedCountry,
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
        i18n.language,
        selectedCountry
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
    [
      openSnackbar,
      t,
      performFarmsGeneration,
      setAnalysisOutdated,
      i18n.language,
      selectedCountry,
    ]
  );

  if (loading && selectedMapsForDeforestation.length > 0)
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
        {farmsData && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              marginTop: 2,
            }}
          >
            {t("deforestationAnalysis:uploadDataPage:uploadStep:loadedFarms", {
              count: farmsData.length,
            })}
            <Button
              variant="contained"
              onClick={() => setAnalysisRequested(true)}
              disabled={selectedMapsForDeforestation.length === 0}
            >
              {t("deforestationAnalysis:uploadDataPage:uploadStep:analyzeLoadedFarms")}
            </Button>
          </Box>
        )}
      </TextHeaderStepContainer>
    </UploadPageContent>
  );
}
