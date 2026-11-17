"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { generateFarmsData } from "@/api/farms";
import { analyzeLayers } from "@/api/layerAnalysis";
import {
  DataContext,
  readFlowGeneration,
  readSelectedCountry,
} from "@/context/DataContext";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { FarmsUploadStep } from "@/components/page/uploadData/FarmsUploadStep";
import { useUploadSources } from "@/components/page/uploadData/useUploadSources";
import { TextHeaderStepContainer } from "@/components/page/uploadData/TextHeaderStepContainer";
import { useTranslation } from "react-i18next";
import { FarmData } from "@/interfaces/Farm";
import type { MapData } from "@/interfaces/DeforestationAnalysis";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { MessageBox } from "@/components/reusable/MessageBox";
import { Text } from "@/components/reusable/Text";
import { StageEyebrow } from "@/components/page/flow/StageEyebrow";
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import FileUploadOutlinedIcon from "@mui/icons-material/FileUploadOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { getCountryName } from "@/utils/countries";
import { FarmRow } from "@/interfaces/FarmRow";
import { LayerCategoryPicker } from "./LayerCategoryPicker";
import { groupLayersByCategory } from "@/utils/layerResults";

// Where "Subir polígonos" scrolls to.
const UPLOAD_STEP_ID = "territorial-analysis-upload";

/**
 * Stage 2's selection page: the polygon subset (after a validation), the layers by
 * category and the farms. The analysis starts only from "Analizar", after a file is
 * uploaded here, or to recalculate an analysis a layer change invalidated; never
 * because the page opened with farms and layers loaded (e.g. through the browser's
 * back button), so no analysis runs with choices the user didn't see.
 */
export function DeforestationAnalysisUploadDataPageContent() {
  const { openSnackbar } = useContext(SnackbarContext);
  const router = useRouter();
  const {
    availableMaps,
    availableCategories,
    availableMapsError,
    farmsData,
    setFarmsData,
    polygonsValidationResults,
    setPolygonsValidationResults,
    deforestationAnalysisParams: {
      selectedMaps: selectedMapsForDeforestation,
      polygonsSubset,
    },
    setDeforestationAnalysisParams,
    setDeforestationAnalysisResults,
    selectedCountry,
    analysisOutdated,
    setAnalysisOutdated,
    refreshAvailableMaps,
  } = useContext(DataContext);
  const { t, i18n } = useTranslation();

  // A layer enabled since the last fetch shows up when the page opens.
  useEffect(() => {
    refreshAvailableMaps();
  }, [refreshAvailableMaps]);

  // Only an outdated analysis restarts on its own when the page opens: its subset
  // and layers were already chosen. Anything else waits for "Analizar".
  const recalculateOnOpen =
    analysisOutdated && !!farmsData && selectedMapsForDeforestation.length > 0;
  const [loading, setLoading] = useState(() => recalculateOnOpen);
  // Whether the analysis may start: to recalculate an outdated analysis, after a
  // file is parsed, or from the "Analizar" button. Choosing layers or the subset
  // never starts it.
  const [analysisRequested, setAnalysisRequested] = useState(
    () => recalculateOnOpen
  );
  // The upload step is open when there are no farms; with farms, behind a button.
  const [uploadOpen, setUploadOpen] = useState(() => !farmsData);
  // The inputs of the latest analysis request, and whether the page is mounted:
  // a request only stores its results while both still hold.
  const prevDataRef = useRef<string | null>(null);
  // Counts analysis requests, so a stale one can tell whether a newer one is
  // still pending (and owns the loading screen).
  const latestRequestRef = useRef(0);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const countryName = selectedCountry
    ? (getCountryName(selectedCountry, i18n.language === "en" ? "en" : "es") ??
      selectedCountry)
    : "";

  // The country's layers that can be offered: listed for it, with a category.
  const countryLayers = useMemo(
    () =>
      availableMaps.filter(
        ({ availableCountriesCodes }) =>
          !!selectedCountry && availableCountriesCodes.includes(selectedCountry)
      ),
    [availableMaps, selectedCountry]
  );
  const offeredGroups = useMemo(
    () =>
      groupLayersByCategory(countryLayers, availableCategories).filter(
        ({ category }) => category !== null
      ),
    [countryLayers, availableCategories]
  );
  const selectedIds = useMemo(
    () => new Set(selectedMapsForDeforestation.map(({ id }) => id)),
    [selectedMapsForDeforestation]
  );
  const selectedCategoriesCount = useMemo(
    () =>
      new Set(
        selectedMapsForDeforestation.map(({ categoryId }) => categoryId)
      ).size,
    [selectedMapsForDeforestation]
  );

  const validFarmsCount = useMemo(
    () =>
      farmsData?.filter(
        (farm) =>
          polygonsValidationResults?.farmResults.find(
            ({ farmId }) => farmId === farm.id
          )?.status !== FarmValidationStatus.NOT_VALID
      ).length ?? 0,
    [farmsData, polygonsValidationResults]
  );
  const hasValidation = !!farmsData && !!polygonsValidationResults;
  // With a validation, "valid only" is the default until the user picks "all".
  const subset = polygonsSubset ?? "valid";
  const analysedFarmsCount =
    hasValidation && subset === "valid"
      ? validFarmsCount
      : (farmsData?.length ?? 0);

  const onSubsetChange = useCallback(
    (value: "all" | "valid") => {
      setDeforestationAnalysisParams((prev) => ({
        ...prev,
        polygonsSubset: value,
      }));
    },
    [setDeforestationAnalysisParams]
  );

  const onMapSelectionChange = useCallback(
    (layer: MapData, checked: boolean) => {
      setAnalysisRequested(false);
      setDeforestationAnalysisParams((prev) => ({
        ...prev,
        selectedMaps: checked
          ? [...prev.selectedMaps.filter(({ id }) => id !== layer.id), layer]
          : prev.selectedMaps.filter(({ id }) => id !== layer.id),
      }));
    },
    [setDeforestationAnalysisParams]
  );

  const performFarmsGeneration = useCallback(
    async (data: Record<string, unknown>[]) => {
      const generation = readFlowGeneration();
      try {
        // The upload has no country column: every farm is in the analysis country.
        const results = await generateFarmsData(
          data.map((row) => ({ ...row, country: selectedCountry })),
          i18n.language,
          { country: selectedCountry, module: "deforestation-analysis" }
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
        // A validation of earlier farms doesn't describe these: without it,
        // stage 1 shows as not done and no farm is hidden as invalid.
        setPolygonsValidationResults(null);
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
    [
      openSnackbar,
      setFarmsData,
      setPolygonsValidationResults,
      t,
      i18n.language,
      selectedCountry,
    ]
  );

  const performDeforestationAnalysis = useCallback(
    async (data: FarmData[], isCurrent: () => boolean) => {
      const request = ++latestRequestRef.current;
      // A stale response turns the loading screen off, unless a newer request
      // is pending.
      const settleStale = () => {
        if (request === latestRequestRef.current) setLoading(false);
      };
      setLoading(true);
      try {
        const response = await analyzeLayers(
          data,
          selectedMapsForDeforestation,
          selectedCountry!
        );
        // A newer request (another country, or a layer that changed again)
        // supersedes this one.
        if (!isCurrent()) return settleStale();
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
        if (!isCurrent()) return settleStale();
        openSnackbar({
          message: t("common:snackbarAlerts:performingAnalysisError"),
          type: "error",
        });
        setLoading(false);
        // Back to the form: the "Analizar" button retries.
        setAnalysisRequested(false);
      }
    },
    [
      selectedMapsForDeforestation,
      selectedCountry,
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

  const upload = useUploadSources(selectedCountry);

  const onUpload = useCallback(
    (rows: FarmRow[]) => {
      // A new upload is a new analysis, not a recalculation of an outdated one.
      setAnalysisOutdated(false);
      setLoading(true);
      performFarmsGeneration(rows);
    },
    [performFarmsGeneration, setAnalysisOutdated]
  );

  const onAnalyze = useCallback(() => {
    // The subset on screen is the one analysed, even if none was stored yet.
    setDeforestationAnalysisParams((prev) => ({
      ...prev,
      polygonsSubset: prev.polygonsSubset ?? "valid",
    }));
    setAnalysisRequested(true);
  }, [setDeforestationAnalysisParams]);

  const openUpload = useCallback(() => {
    setUploadOpen(true);
    // After the step renders.
    setTimeout(() =>
      document
        .getElementById(UPLOAD_STEP_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, []);

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

  const canAnalyze = !!farmsData && selectedMapsForDeforestation.length > 0;

  return (
    <Box
      sx={{
        padding: 1.5,
        paddingTop: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <Box sx={{ marginLeft: 1.5 }}>
        <StageEyebrow />
        <Text variant="h3" bold>
          {t("deforestationAnalysis:uploadDataPage:title")}
        </Text>
        <Text sx={{ color: "text.secondary", marginTop: 0.5 }}>
          {t("deforestationAnalysis:uploadDataPage:subtitle", {
            country: countryName,
          })}
        </Text>
      </Box>

      {!farmsData && (
        <Alert
          severity="warning"
          action={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button color="inherit" size="small" onClick={openUpload}>
                {t("deforestationAnalysis:uploadDataPage:directEntry.upload")}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() => router.push("/polygons-validation/upload-data")}
              >
                {t("deforestationAnalysis:uploadDataPage:directEntry.validate")}
              </Button>
            </Box>
          }
          sx={{
            alignItems: "center",
            flexWrap: { xs: "wrap", sm: "nowrap" },
            "& .MuiAlert-action": { marginLeft: { xs: 0, sm: "auto" } },
          }}
        >
          {t("deforestationAnalysis:uploadDataPage:directEntry.message")}
        </Alert>
      )}

      {hasValidation && (
        <Alert severity="info" icon={false} sx={{ alignItems: "center" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <span>
              {t("deforestationAnalysis:uploadDataPage:subset.message", {
                count: analysedFarmsCount,
              })}
            </span>
            <RadioGroup
              row
              value={subset}
              onChange={(_, value) => onSubsetChange(value as "all" | "valid")}
              aria-label={t("deforestationAnalysis:uploadDataPage:subset.label")}
              sx={{ columnGap: 3 }}
            >
              <FormControlLabel
                value="valid"
                control={<Radio size="small" />}
                label={t("deforestationAnalysis:uploadDataPage:subset.valid", {
                  count: validFarmsCount,
                })}
              />
              <FormControlLabel
                value="all"
                control={<Radio size="small" />}
                label={t("deforestationAnalysis:uploadDataPage:subset.all", {
                  count: farmsData.length,
                })}
              />
            </RadioGroup>
          </Box>
        </Alert>
      )}

      <TextHeaderStepContainer
        title={t(
          "deforestationAnalysis:uploadDataPage:mapSelectionStep:stepTitle"
        )}
        subtitle={t(
          "deforestationAnalysis:uploadDataPage:mapSelectionStep:subtitle",
          { country: countryName }
        )}
        icon={<LayersOutlinedIcon />}
      >
        {offeredGroups.length > 0 ? (
          <LayerCategoryPicker
            layers={countryLayers}
            categories={availableCategories}
            selectedIds={selectedIds}
            onChange={onMapSelectionChange}
          />
        ) : (
          <MessageBox
            message={t(
              availableMapsError
                ? "deforestationAnalysis:uploadDataPage:mapSelectionStep:mapsLoadError"
                : "deforestationAnalysis:uploadDataPage:mapSelectionStep:noMapsAvailable",
              { country: countryName }
            )}
          />
        )}
      </TextHeaderStepContainer>

      <Box id={UPLOAD_STEP_ID} sx={{ scrollMarginTop: 16 }}>
        <TextHeaderStepContainer
          title={t("deforestationAnalysis:uploadDataPage:uploadStep:stepTitle")}
          subtitle={t("common:farmsUpload:intro")}
          icon={<FileUploadOutlinedIcon />}
        >
          {uploadOpen ? (
            <FarmsUploadStep
              upload={upload}
              country={selectedCountry}
              submitLabel={t(
                "deforestationAnalysis:uploadDataPage:uploadStep:submit"
              )}
              onSubmit={onUpload}
              disabled={selectedMapsForDeforestation.length === 0}
            />
          ) : (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <span>
                {t("deforestationAnalysis:uploadDataPage:uploadStep:loadedFarms", {
                  count: farmsData?.length ?? 0,
                })}
              </span>
              <Button variant="outlined" onClick={openUpload}>
                {t("deforestationAnalysis:uploadDataPage:uploadStep:uploadAnother")}
              </Button>
            </Box>
          )}
        </TextHeaderStepContainer>
      </Box>

      <Box
        sx={{
          position: "sticky",
          bottom: 0,
          zIndex: 2,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          padding: "12px 16px",
          borderRadius: 3,
          backgroundColor: "#FFFFFF",
          border: "1px solid #DEDEDE",
          boxShadow: "0 -6px 18px rgba(11, 37, 69, 0.08)",
        }}
      >
        <Text sx={{ color: "text.secondary" }}>
          {t("deforestationAnalysis:uploadDataPage:summary", {
            polygons: t("deforestationAnalysis:results.polygonCount", {
              count: analysedFarmsCount,
            }),
            layers: t("deforestationAnalysis:results.layerCount", {
              count: selectedMapsForDeforestation.length,
            }),
            categories: t("deforestationAnalysis:uploadDataPage:categoryCount", {
              count: selectedCategoriesCount,
            }),
          })}
        </Text>
        <Button
          variant="contained"
          endIcon={<ArrowForwardRoundedIcon />}
          disabled={!canAnalyze}
          onClick={onAnalyze}
          sx={{ marginLeft: "auto" }}
        >
          {t("deforestationAnalysis:uploadDataPage:uploadStep:analyzeLoadedFarms")}
        </Button>
      </Box>
    </Box>
  );
}
