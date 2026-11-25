"use client";

import { Suspense, useContext, useEffect } from "react";
import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { ReportProvider } from "@/context/ReportContext";
import { useAnalysedLayers } from "@/hooks/useAnalysedLayers";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { FlowPage } from "@/components/page/flow/FlowPage";
import { FlowPageHead } from "@/components/page/flow/FlowPageHead";
import { ReportFarmList } from "./ReportFarmList";
import { ReportLayerPicker } from "./ReportLayerPicker";
import { ReportActions } from "./ReportActions";
import { ReportPreviewPanel } from "./ReportPreviewPanel";

const SIDEBAR_WIDTH = 380;

/**
 * Stage 3: the report's polygons and layers at the left, its preview at the right.
 * The first visit for an analysis ticks every polygon and every analysed layer;
 * later visits keep the user's choice, even an empty one.
 */
export const ReportPageContent: React.FC = () => {
  const { t } = useTranslation();
  const {
    reportGenerationParams: { seeded },
    setReportGenerationParams,
  } = useContext(DataContext);
  const { farmsData } = useVisibleDataForAnalysisPage();
  const layers = useAnalysedLayers();

  useEffect(() => {
    if (seeded || !farmsData.length || !layers.length) return;
    setReportGenerationParams((prev) => ({
      ...prev,
      seeded: true,
      selectedFarms: farmsData,
      selectedMaps: layers,
    }));
  }, [seeded, farmsData, layers, setReportGenerationParams]);

  return (
    <ReportProvider>
      <FlowPage>
        <FlowPageHead
          title={t("reportGeneration:page.title")}
          subtitle={t("reportGeneration:page.subtitle")}
        />
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: `${SIDEBAR_WIDTH}px minmax(0, 1fr)`,
            },
            alignItems: "start",
            gap: 2.25,
          }}
        >
          <Box
            component="aside"
            aria-label={t("reportGeneration:sidebar.title")}
            sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}
          >
            {/* The search is read from the URL */}
            <Suspense>
              <ReportFarmList />
            </Suspense>
            <ReportLayerPicker />
            <ReportActions />
          </Box>
          <ReportPreviewPanel />
        </Box>
      </FlowPage>
    </ReportProvider>
  );
};
