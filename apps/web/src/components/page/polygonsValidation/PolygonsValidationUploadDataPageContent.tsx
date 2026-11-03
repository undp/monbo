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
import { TextHeaderStepContainer } from "@/components/page/uploadData/TextHeaderStepContainer";
import { FarmData } from "@/interfaces/Farm";
import { sum } from "lodash";
import { FarmRow } from "@/interfaces/FarmRow";

export function PolygonsValidationUploadDataPageContent() {
  const [loading, setLoading] = useState<boolean>(false);
  const { openSnackbar } = useContext(SnackbarContext);
  const {
    farmsData,
    setFarmsData,
    setPolygonsValidationResults,
    selectedCountry,
  } = useContext(DataContext);
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const prevDataRef = useRef<string | null>(null);
  // A parser response that arrives after the page was left is dropped.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

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

  const upload = useUploadSources(selectedCountry);

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
    <UploadPageContent title={t("polygonValidation:uploadDataPage:title")}>
      <TextHeaderStepContainer
        title={t("polygonValidation:uploadDataPage:uploadStep:stepTitle")}
        sx={{ flexGrow: 1 }}
      >
        <FarmsUploadStep
          upload={upload}
          country={selectedCountry}
          submitLabel={t("polygonValidation:uploadDataPage:uploadStep:submit")}
          onSubmit={onUpload}
        />
      </TextHeaderStepContainer>
    </UploadPageContent>
  );
}
