"use client";

import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { generateFarmsData } from "@/api/farms";
import {
  DataContext,
  readFlowGeneration,
  readSelectedCountry,
} from "@/context/DataContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { LoadingScreen } from "@/components/reusable/LoadingScreen";
import { UploadPageContent } from "@/components/page/uploadData/UploadPageContent";
import { FarmsUploadStep } from "@/components/page/uploadData/FarmsUploadStep";
import { useUploadSources } from "@/components/page/uploadData/useUploadSources";
import { FarmRow } from "@/interfaces/FarmRow";
import { localizedPath } from "@/utils/languageChange";

const LAYERS_PAGE = "/territorial-analysis/layers";

/**
 * Stage 2's upload: the flow's list of polygons, as on stage 1. "Continuar" takes
 * the user to the layers; it starts no analysis. The list is parsed only when it
 * changed since the loaded farms were parsed from it: then the new farms replace
 * them, and every result of the earlier farms is dropped. Unchanged, the farms
 * and their results stay.
 */
export function TerritorialAnalysisUploadDataPageContent() {
  const [loading, setLoading] = useState(false);
  const { openSnackbar } = useContext(SnackbarContext);
  const {
    farmsData,
    setFarmsData,
    setPolygonsValidationResults,
    setTerritorialAnalysisResults,
    setAnalysisOutdated,
    setReportGenerationParams,
    uploadSourcesRevision,
    farmsSourcesRevision,
    setFarmsSourcesRevision,
    selectedCountry,
  } = useContext(DataContext);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  // A parser response that arrives after the page was left is dropped.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const toLayers = useCallback(
    () => router.push(localizedPath(LAYERS_PAGE, i18n.language)),
    [router, i18n.language]
  );

  const parseFarms = useCallback(
    async (rows: FarmRow[]) => {
      const generation = readFlowGeneration();
      // The list as it is now: the farms parsed from it remember which one
      const revision = uploadSourcesRevision;
      setLoading(true);
      try {
        // The upload has no country column: every farm is in the analysis country.
        const results = await generateFarmsData(
          rows.map((row) => ({ ...row, country: selectedCountry })),
          i18n.language,
          { country: selectedCountry, module: "deforestation-analysis" }
        );
        // Left meanwhile, or started over: don't bring the farms back.
        if (!mountedRef.current) return;
        if (readFlowGeneration() !== generation) {
          setLoading(false);
          return;
        }
        // The country can change while the parser request is in flight.
        setFarmsData(
          results.map((farm) => ({
            ...farm,
            country: readSelectedCountry() ?? farm.country,
          }))
        );
        setFarmsSourcesRevision(revision);
        // A validation or an analysis of the earlier farms doesn't describe these:
        // without the validation, stage 1 shows as not done and no farm is hidden
        // as invalid. The layers and subset chosen (the draft) are kept.
        setPolygonsValidationResults(null);
        setTerritorialAnalysisResults(null);
        setAnalysisOutdated(false);
        setReportGenerationParams((prev) => ({
          ...prev,
          selectedMaps: [],
          selectedFarms: [],
          downloadType: null,
        }));
        toLayers();
      } catch (error) {
        console.error(error);
        if (!mountedRef.current) return;
        openSnackbar({
          message: t("common:snackbarAlerts:parsingFarmsDataError"),
          type: "error",
        });
        setLoading(false);
      }
    },
    [
      uploadSourcesRevision,
      selectedCountry,
      i18n.language,
      setFarmsData,
      setFarmsSourcesRevision,
      setPolygonsValidationResults,
      setTerritorialAnalysisResults,
      setAnalysisOutdated,
      setReportGenerationParams,
      toLayers,
      openSnackbar,
      t,
    ]
  );

  const onContinue = useCallback(
    (rows: FarmRow[]) => {
      // The loaded farms come from this very list: nothing to parse again.
      if (farmsData && farmsSourcesRevision === uploadSourcesRevision) {
        toLayers();
        return;
      }
      void parseFarms(rows);
    },
    [farmsData, farmsSourcesRevision, uploadSourcesRevision, toLayers, parseFarms]
  );

  const upload = useUploadSources(selectedCountry, { kept: true });

  if (loading)
    return (
      <LoadingScreen text={t("territorialAnalysis:uploadDataPage:loadingText")} />
    );

  return (
    <UploadPageContent
      title={t("territorialAnalysis:uploadDataPage:title")}
      subtitle={t("territorialAnalysis:uploadDataPage:uploadSubtitle")}
    >
      <FarmsUploadStep
        variant="page"
        upload={upload}
        country={selectedCountry}
        submitLabel={t("territorialAnalysis:uploadDataPage:continue")}
        onSubmit={onContinue}
        // Emptying the list doesn't drop the farms loaded from it on its own
        keepBar={!!farmsData}
      />
    </UploadPageContent>
  );
}
