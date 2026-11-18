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
  type AnalysisDraft,
  DataContext,
  readFlowGeneration,
  readSelectedCountry,
} from "@/context/DataContext";
import { localizedPath } from "@/utils/languageChange";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { FarmsUploadStep } from "@/components/page/uploadData/FarmsUploadStep";
import { useUploadSources } from "@/components/page/uploadData/useUploadSources";
import { TextHeaderStepContainer } from "@/components/page/uploadData/TextHeaderStepContainer";
import { useTranslation } from "react-i18next";
import { FarmData } from "@/interfaces/Farm";
import type { MapData } from "@/interfaces/LayerAnalysis";
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

type PolygonsSubset = AnalysisDraft["polygonsSubset"];

/**
 * What starts an analysis: `draft` runs the page's choices ("Analizar", or a file
 * uploaded here); `recalculate` re-runs the analysed choices after a layer change
 * invalidated the results.
 */
type AnalysisMode = "draft" | "recalculate";

/**
 * Stage 2's selection page: the polygon subset (after a validation), the layers by
 * category and the farms. What the user picks here is a draft (`analysisDraft`):
 * the current results, and the report, keep the subset and layers they were
 * analysed with (`territorialAnalysisParams`) until a new analysis succeeds.
 * The analysis starts only from "Analizar", after a file is uploaded here, or to
 * recalculate an analysis a layer change invalidated; never because the page
 * opened with farms and layers loaded (e.g. through the browser's back button).
 * A layer that isn't offered (hidden, or with no category) never enters an
 * analysis.
 */
export function TerritorialAnalysisUploadDataPageContent() {
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
    territorialAnalysisParams: {
      selectedMaps: analysedMaps,
      polygonsSubset: analysedSubset,
    },
    setTerritorialAnalysisParams,
    analysisDraft,
    setAnalysisDraft,
    setTerritorialAnalysisResults,
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

  // The page's choices: the stored draft, or else the analysed ones. Kept here so
  // the page shows each change at once, and stored so they survive a visit to
  // stage 1; never written to the analysed params until an analysis succeeds.
  const [draft, setDraft] = useState<AnalysisDraft>(
    () =>
      analysisDraft ?? {
        polygonsSubset: analysedSubset ?? "valid",
        selectedMapIds: analysedMaps.map(({ id }) => id),
      }
  );
  const updateDraft = useCallback(
    (update: (prev: AnalysisDraft) => AnalysisDraft) => {
      const next = update(draft);
      setDraft(next);
      setAnalysisDraft(next);
    },
    [draft, setAnalysisDraft]
  );

  // Only an outdated analysis restarts on its own when the page opens: its subset
  // and layers were already chosen. Anything else waits for "Analizar".
  const recalculateOnOpen =
    analysisOutdated && !!farmsData && analysedMaps.length > 0;
  const [loading, setLoading] = useState(() => recalculateOnOpen);
  // Choosing layers or the subset never starts an analysis.
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode | null>(() =>
    recalculateOnOpen ? "recalculate" : null
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
  const offeredById = useMemo(
    () =>
      new Map(
        offeredGroups.flatMap(({ layers }) =>
          layers.map((layer) => [layer.id, layer] as const)
        )
      ),
    [offeredGroups]
  );
  // The draft's layers that are offered now, with their current metadata. A layer
  // hidden since it was chosen drops out: it is not counted, not shown and not
  // analysed.
  const draftLayers = useMemo(
    () =>
      draft.selectedMapIds.flatMap((id) => {
        const layer = offeredById.get(id);
        return layer ? [layer] : [];
      }),
    [draft.selectedMapIds, offeredById]
  );
  const selectedIds = useMemo(
    () => new Set(draftLayers.map(({ id }) => id)),
    [draftLayers]
  );
  const selectedCategoriesCount = useMemo(
    () => new Set(draftLayers.map(({ categoryId }) => categoryId)).size,
    [draftLayers]
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
  const subset = draft.polygonsSubset;
  const analysedFarmsCount =
    hasValidation && subset === "valid"
      ? validFarmsCount
      : (farmsData?.length ?? 0);

  // What the next request analyses: the draft, or (to recalculate) the analysed
  // choices. Either way, only layers that are offered now.
  const requestedMaps = useMemo(
    () =>
      analysisMode === "recalculate"
        ? analysedMaps.filter(({ id }) => offeredById.has(id))
        : draftLayers,
    [analysisMode, analysedMaps, offeredById, draftLayers]
  );
  const requestedSubset: PolygonsSubset =
    analysisMode === "recalculate" ? (analysedSubset ?? "valid") : subset;

  const onSubsetChange = useCallback(
    (value: PolygonsSubset) => {
      updateDraft((prev) => ({ ...prev, polygonsSubset: value }));
    },
    [updateDraft]
  );

  const onMapSelectionChange = useCallback(
    (layer: MapData, checked: boolean) => {
      setAnalysisMode(null);
      updateDraft((prev) => {
        const others = prev.selectedMapIds.filter((id) => id !== layer.id);
        return {
          ...prev,
          selectedMapIds: checked ? [...others, layer.id] : others,
        };
      });
    },
    [updateDraft]
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
        setAnalysisMode("draft");
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

  const performAnalysis = useCallback(
    async (
      data: FarmData[],
      maps: MapData[],
      polygonsSubset: PolygonsSubset,
      mode: AnalysisMode,
      isCurrent: () => boolean
    ) => {
      const request = ++latestRequestRef.current;
      // A stale response turns the loading screen off, unless a newer request
      // is pending.
      const settleStale = () => {
        if (request === latestRequestRef.current) setLoading(false);
      };
      setLoading(true);
      try {
        const response = await analyzeLayers(data, maps, selectedCountry!);
        // A newer request (another country, or a layer that changed again)
        // supersedes this one.
        if (!isCurrent()) return settleStale();
        // The results and the choices they were analysed with change together.
        setTerritorialAnalysisResults(response);
        setTerritorialAnalysisParams({ polygonsSubset, selectedMaps: maps });
        // The draft was analysed: the page now starts from the results. A
        // recalculation re-ran the analysed choices, so a pending draft stays.
        if (mode === "draft") setAnalysisDraft(null);
        setAnalysisOutdated(false);
        router.push(localizedPath("/territorial-analysis", i18n.language));
        openSnackbar({
          message: analysisOutdated
            ? t("territorialAnalysis:uploadDataPage:analysisUpdated")
            : t("common:snackbarAlerts:dataAnalyzedSuccessfully"),
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
        setAnalysisMode(null);
      }
    },
    [
      selectedCountry,
      router,
      setTerritorialAnalysisResults,
      setTerritorialAnalysisParams,
      setAnalysisDraft,
      setAnalysisOutdated,
      analysisOutdated,
      openSnackbar,
      t,
      i18n.language,
    ]
  );

  useEffect(() => {
    if (!analysisMode || !farmsData || !requestedMaps.length) {
      prevDataRef.current = null;
      return;
    }

    const serializedData = JSON.stringify({
      country: selectedCountry,
      farms: farmsData.map((farm) => [farm.id, farm.country]),
      subset: requestedSubset,
      // A layer whose calculation inputs change while the request is pending
      // (e.g. replaced again during a recalculation) re-runs it.
      calculationInputs: requestedMaps.map((map) => [
        map.id,
        map.version,
        map.pixelSize,
        map.baseline,
        map.comparedAgainst,
      ]),
    });
    if (serializedData === prevDataRef.current) return;

    prevDataRef.current = serializedData;
    // Superseded once the inputs change (prevDataRef moves on), the country
    // changes or the page unmounts. A re-run with the same inputs (e.g. the maps
    // list refreshed, or Strict Mode replaying the effect) keeps it current.
    void performAnalysis(
      farmsData,
      requestedMaps,
      requestedSubset,
      analysisMode,
      () =>
        mountedRef.current &&
        prevDataRef.current === serializedData &&
        readSelectedCountry() === selectedCountry
    );
  }, [
    analysisMode,
    farmsData,
    selectedCountry,
    requestedMaps,
    requestedSubset,
    performAnalysis,
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

  const onAnalyze = useCallback(() => setAnalysisMode("draft"), []);

  const openUpload = useCallback(() => {
    setUploadOpen(true);
    // After the step renders.
    setTimeout(() =>
      document
        .getElementById(UPLOAD_STEP_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }, []);

  // A recalculation whose layers are all hidden now has nothing to run: the form
  // shows, so the user can pick others.
  const nothingToRecalculate =
    analysisMode === "recalculate" && requestedMaps.length === 0;
  if (loading && !nothingToRecalculate)
    return (
      <LoadingScreen
        text={t(
          analysisOutdated
            ? "territorialAnalysis:uploadDataPage:recalculatingText"
            : "territorialAnalysis:uploadDataPage:loadingText"
        )}
      />
    );

  const canAnalyze = !!farmsData && draftLayers.length > 0;

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
          {t("territorialAnalysis:uploadDataPage:title")}
        </Text>
        <Text sx={{ color: "text.secondary", marginTop: 0.5 }}>
          {t("territorialAnalysis:uploadDataPage:subtitle", {
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
                {t("territorialAnalysis:uploadDataPage:directEntry.upload")}
              </Button>
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  router.push(
                    localizedPath("/polygons-validation/upload-data", i18n.language)
                  )
                }
              >
                {t("territorialAnalysis:uploadDataPage:directEntry.validate")}
              </Button>
            </Box>
          }
          sx={{
            alignItems: "center",
            flexWrap: { xs: "wrap", sm: "nowrap" },
            "& .MuiAlert-action": { marginLeft: { xs: 0, sm: "auto" } },
          }}
        >
          {t("territorialAnalysis:uploadDataPage:directEntry.message")}
        </Alert>
      )}

      {hasValidation && (
        <Alert severity="info" icon={false} sx={{ alignItems: "center" }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <span>
              {t("territorialAnalysis:uploadDataPage:subset.message", {
                count: analysedFarmsCount,
              })}
            </span>
            <RadioGroup
              row
              value={subset}
              onChange={(_, value) => onSubsetChange(value as PolygonsSubset)}
              aria-label={t("territorialAnalysis:uploadDataPage:subset.label")}
              sx={{ columnGap: 3 }}
            >
              <FormControlLabel
                value="valid"
                control={<Radio size="small" />}
                label={t("territorialAnalysis:uploadDataPage:subset.valid", {
                  count: validFarmsCount,
                })}
              />
              <FormControlLabel
                value="all"
                control={<Radio size="small" />}
                label={t("territorialAnalysis:uploadDataPage:subset.all", {
                  count: farmsData.length,
                })}
              />
            </RadioGroup>
          </Box>
        </Alert>
      )}

      <TextHeaderStepContainer
        title={t(
          "territorialAnalysis:uploadDataPage:mapSelectionStep:stepTitle"
        )}
        subtitle={t(
          "territorialAnalysis:uploadDataPage:mapSelectionStep:subtitle",
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
                ? "territorialAnalysis:uploadDataPage:mapSelectionStep:mapsLoadError"
                : "territorialAnalysis:uploadDataPage:mapSelectionStep:noMapsAvailable",
              { country: countryName }
            )}
          />
        )}
      </TextHeaderStepContainer>

      <Box id={UPLOAD_STEP_ID} sx={{ scrollMarginTop: 16 }}>
        <TextHeaderStepContainer
          title={t("territorialAnalysis:uploadDataPage:uploadStep:stepTitle")}
          subtitle={t("common:farmsUpload:intro")}
          icon={<FileUploadOutlinedIcon />}
        >
          {uploadOpen ? (
            <FarmsUploadStep
              upload={upload}
              country={selectedCountry}
              submitLabel={t(
                "territorialAnalysis:uploadDataPage:uploadStep:submit"
              )}
              onSubmit={onUpload}
              disabled={draftLayers.length === 0}
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
                {t("territorialAnalysis:uploadDataPage:uploadStep:loadedFarms", {
                  count: farmsData?.length ?? 0,
                })}
              </span>
              <Button variant="outlined" onClick={openUpload}>
                {t("territorialAnalysis:uploadDataPage:uploadStep:uploadAnother")}
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
          {t("territorialAnalysis:uploadDataPage:summary", {
            polygons: t("territorialAnalysis:results.polygonCount", {
              count: analysedFarmsCount,
            }),
            layers: t("territorialAnalysis:results.layerCount", {
              count: draftLayers.length,
            }),
            categories: t("territorialAnalysis:uploadDataPage:categoryCount", {
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
          {t("territorialAnalysis:uploadDataPage:uploadStep:analyzeLoadedFarms")}
        </Button>
      </Box>
    </Box>
  );
}
