"use client";

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { analyzeLayers } from "@/api/layerAnalysis";
import {
  type AnalysisDraft,
  DataContext,
  initialReportGenerationParams,
  readSelectedCountry,
} from "@/context/DataContext";
import { localizedPath } from "@/utils/languageChange";
import { useRouter } from "next/navigation";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { useTranslation } from "react-i18next";
import { FarmData } from "@/interfaces/Farm";
import type { MapData } from "@/interfaces/LayerAnalysis";
import { FarmValidationStatus } from "@/interfaces/PolygonValidation";
import { MessageBox } from "@/components/reusable/MessageBox";
import { FlowPage } from "@/components/page/flow/FlowPage";
import { FlowPageHead } from "@/components/page/flow/FlowPageHead";
import { FlowSection } from "@/components/page/flow/FlowSection";
import { FlowBottomBar } from "@/components/page/flow/FlowBottomBar";
import { SummaryStat } from "@/components/page/flow/SummaryStat";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { Box, Button, Link } from "@mui/material";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import PentagonOutlinedIcon from "@mui/icons-material/PentagonOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import NorthEastRoundedIcon from "@mui/icons-material/NorthEastRounded";
import { getCountryName } from "@/utils/countries";
import { LayerCategoryPicker } from "./LayerCategoryPicker";
import { SubsetBanner } from "./SubsetBanner";
import { groupLayersByCategory } from "@/utils/layerResults";

type PolygonsSubset = AnalysisDraft["polygonsSubset"];

/**
 * What starts an analysis: `draft` runs the page's choices ("Analizar");
 * `recalculate` re-runs the analysed choices after a layer change invalidated the
 * results.
 */
type AnalysisMode = "draft" | "recalculate";

/**
 * Stage 2's layers page: the polygon subset (after a validation) and the layers
 * by category, for the farms uploaded before (on stage 1, or on stage 2's upload
 * page). What the user picks here is a draft (`analysisDraft`): the current
 * results, and the report, keep the subset and layers they were analysed with
 * (`territorialAnalysisParams`) until a new analysis succeeds. The analysis
 * starts only from "Analizar", or to recalculate an analysis a layer change
 * invalidated; never because the page opened with farms and layers loaded (e.g.
 * through the browser's back button). A layer that isn't offered (hidden, or with
 * no category) never enters an analysis. Without farms, the page sends the user
 * to the upload.
 */
export function TerritorialAnalysisLayersPageContent() {
  const { openSnackbar } = useContext(SnackbarContext);
  const router = useRouter();
  const {
    availableMaps,
    availableCategories,
    availableMapsError,
    farmsData,
    polygonsValidationResults,
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
    setReportGenerationParams,
    refreshAvailableMaps,
  } = useContext(DataContext);
  const { t, i18n } = useTranslation();

  // A layer enabled since the last fetch shows up when the page opens.
  useEffect(() => {
    refreshAvailableMaps();
  }, [refreshAvailableMaps]);

  // Nothing to analyse yet: the polygons are uploaded first.
  useEffect(() => {
    if (!farmsData)
      router.replace(
        localizedPath("/territorial-analysis/upload-data", i18n.language)
      );
  }, [farmsData, router, i18n.language]);

  // The page's choices: the stored draft, or else the analysed ones. Kept here so
  // the page shows each change at once, and stored so they survive a visit to
  // another page; never written to the analysed params until an analysis
  // succeeds.
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

  // The farms the validation left out, in upload order.
  const notValidIds = useMemo(
    () =>
      farmsData
        ?.filter(
          (farm) =>
            polygonsValidationResults?.farmResults.find(
              ({ farmId }) => farmId === farm.id
            )?.status === FarmValidationStatus.NOT_VALID
        )
        .map(({ id }) => id) ?? [],
    [farmsData, polygonsValidationResults]
  );
  const validFarmsCount = (farmsData?.length ?? 0) - notValidIds.length;
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
      // The form only shows while loading when a recalculation had no layer to
      // run: leaving it, nothing is pending, so the loading screen must not come
      // back.
      setLoading(false);
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
        // A report choice of the earlier analysis may name other farms or layers:
        // the report page starts again from all of the new ones.
        setReportGenerationParams(initialReportGenerationParams);
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
      setReportGenerationParams,
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

  const onAnalyze = useCallback(() => setAnalysisMode("draft"), []);

  // After a validation the polygons are seen with their status; uploaded here,
  // in the list they came from.
  const onSeePolygons = useCallback(
    () =>
      router.push(
        localizedPath(
          hasValidation
            ? "/polygons-validation"
            : "/territorial-analysis/upload-data",
          i18n.language
        )
      ),
    [router, hasValidation, i18n.language]
  );

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

  // On its way to the upload
  if (!farmsData) return null;

  const canAnalyze = draftLayers.length > 0;

  return (
    <FlowPage>
      <FlowPageHead
        title={t("territorialAnalysis:uploadDataPage:title")}
        subtitle={t("territorialAnalysis:uploadDataPage:subtitle", {
          country: countryName,
        })}
      />

      <SubsetBanner
        count={analysedFarmsCount}
        validation={
          hasValidation
            ? {
                subset,
                onSubsetChange,
                validCount: validFarmsCount,
                allCount: farmsData.length,
                notValidIds,
              }
            : null
        }
        onSeePolygons={onSeePolygons}
      />

      <FlowSection
        title={t("territorialAnalysis:uploadDataPage:mapSelectionStep:stepTitle")}
        subtitle={t("territorialAnalysis:uploadDataPage:mapSelectionStep:subtitle", {
          country: countryName,
        })}
        icon={<LayersOutlinedIcon />}
        action={
          <Link
            href={localizedPath("/documentation#layers", i18n.language)}
            target="_blank"
            rel="noopener"
            underline="hover"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: 14.5,
              fontWeight: 500,
              color: FLOW_COLORS.blue,
              whiteSpace: "nowrap",
            }}
          >
            {t("territorialAnalysis:uploadDataPage:mapSelectionStep:howToRead")}
            <NorthEastRoundedIcon sx={{ fontSize: 16 }} aria-hidden />
          </Link>
        }
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
      </FlowSection>

      <FlowBottomBar
        action={
          <Button
            variant="contained"
            endIcon={<ArrowForwardRoundedIcon />}
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            {t("territorialAnalysis:uploadDataPage:analyze")}
          </Button>
        }
      >
        <SummaryStat
          icon={<PentagonOutlinedIcon fontSize="small" />}
          count={analysedFarmsCount}
          label={t("territorialAnalysis:uploadDataPage:polygonsLabel", {
            count: analysedFarmsCount,
          })}
        />
        <SummaryStat
          icon={<LayersOutlinedIcon fontSize="small" />}
          count={draftLayers.length}
          label={
            <span>
              {t("territorialAnalysis:uploadDataPage:layersInLabel", {
                count: draftLayers.length,
              })}{" "}
              <Box component="b" sx={{ color: FLOW_COLORS.ink, fontSize: 16 }}>
                {selectedCategoriesCount}
              </Box>{" "}
              {t("territorialAnalysis:uploadDataPage:categoriesLabel", {
                count: selectedCategoriesCount,
              })}
            </span>
          }
        />
      </FlowBottomBar>
    </FlowPage>
  );
}
