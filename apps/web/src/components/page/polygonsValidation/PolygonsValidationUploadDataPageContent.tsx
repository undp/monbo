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
import { useTranslation } from "react-i18next";
import { FarmData } from "@/interfaces/Farm";
import { sum } from "lodash";
import { FarmRow } from "@/interfaces/FarmRow";
import {
  ManualValidations,
  manualValidationsOf,
  reconcileManualValidations,
} from "@/utils/validationResults";

export function PolygonsValidationUploadDataPageContent() {
  const [loading, setLoading] = useState<boolean>(false);
  const { openSnackbar } = useContext(SnackbarContext);
  const {
    farmsData,
    setFarmsData,
    polygonsValidationResults,
    setPolygonsValidationResults,
    setTerritorialAnalysisResults,
    setAnalysisOutdated,
    setReportGenerationParams,
    stageOneUploadSources,
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

  const performValidationAnalysis = useCallback(
    async (data: FarmData[], validatedBefore: ManualValidations = new Map()) => {
      setLoading(true);
      try {
        const { results: response, dropped } = reconcileManualValidations(
          validatedBefore,
          await validatePolygons(data, selectedCountry),
          data
        );
        setPolygonsValidationResults(response);
        router.push("/polygons-validation");
        openSnackbar({
          message: t("common:snackbarAlerts:dataAnalyzedSuccessfully"),
          type: "success",
        });
        if (dropped > 0)
          openSnackbar({
            message: t("polygonValidation:manualValidationsDropped", {
              count: dropped,
            }),
            type: "warning",
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
    [setPolygonsValidationResults, router, openSnackbar, t, selectedCountry]
  );

  const performFarmsGeneration = useCallback(
    async (data: Record<string, unknown>[]) => {
      const generation = readFlowGeneration();
      // The farms validated by hand before "Agregar más polígonos", and what
      // they overlapped: kept only where nothing new overlaps them.
      const validatedBefore = manualValidationsOf(polygonsValidationResults, farmsData);
      try {
        // The upload has no country column: every farm is in the analysis country.
        const results = await generateFarmsData(
          data.map((row) => ({ ...row, country: selectedCountry })),
          i18n.language,
          { country: selectedCountry, module: "polygons-validation" }
        );
        // Started over or left meanwhile: don't bring the farms back.
        if (!mountedRef.current || readFlowGeneration() !== generation) return;
        // The country can change while the parser request is in flight.
        const farms = results.map((farm) => ({
          ...farm,
          country: readSelectedCountry() ?? farm.country,
        }));
        setFarmsData(farms);
        // The earlier results describe the earlier farms: if the validation
        // fails, no farm may show as ready without having been validated
        setPolygonsValidationResults(null);
        // An analysis of the earlier farms doesn't describe these
        setTerritorialAnalysisResults(null);
        setAnalysisOutdated(false);
        setReportGenerationParams((prev) => ({
          ...prev,
          selectedMaps: [],
          selectedFarms: [],
          downloadType: null,
        }));
        await performValidationAnalysis(farms, validatedBefore);
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
      setTerritorialAnalysisResults,
      setAnalysisOutdated,
      setReportGenerationParams,
      performValidationAnalysis,
      polygonsValidationResults,
      farmsData,
      t,
      i18n.language,
      selectedCountry,
    ]
  );

  // Farms uploaded on stage 2 and not validated yet are validated on entry, as
  // before. With stage 1's own list kept (back from "Agregar más polígonos"),
  // nothing runs until the user presses the button.
  const validatedOnEntry = useRef(false);
  useEffect(() => {
    if (validatedOnEntry.current) return;
    validatedOnEntry.current = true;
    if (!farmsData || polygonsValidationResults) return;
    if (stageOneUploadSources.length > 0) return;
    performValidationAnalysis(farmsData);
  }, [
    farmsData,
    polygonsValidationResults,
    stageOneUploadSources,
    performValidationAnalysis,
  ]);

  const upload = useUploadSources(selectedCountry, { kept: true });

  const onUpload = useCallback(
    (rows: FarmRow[]) => {
      setLoading(true);
      performFarmsGeneration(rows);
    },
    [performFarmsGeneration]
  );

  if (loading)
    return (
      <LoadingScreen text={t("polygonValidation:uploadDataPage:loadingText")} />
    );

  return (
    <UploadPageContent
      title={t("polygonValidation:uploadDataPage:title")}
      subtitle={t("polygonValidation:uploadDataPage:subtitle")}
    >
      <FarmsUploadStep
        variant="page"
        upload={upload}
        country={selectedCountry}
        submitLabel={t("polygonValidation:uploadDataPage:uploadStep:submit")}
        onSubmit={onUpload}
      />
    </UploadPageContent>
  );
}
