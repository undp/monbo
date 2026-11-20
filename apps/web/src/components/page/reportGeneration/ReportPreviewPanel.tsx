"use client";

import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { ReportContext } from "@/context/ReportContext";
import { useReportPreviewRequest } from "@/hooks/useReportPreviewRequest";
import { FLOW_COLORS, STAGE_CARD } from "@/components/page/flow/flowStyles";

// Read by screen readers, not shown
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
} as const;

/** The panel's height on a wide screen: the viewport under the app header. */
export const PREVIEW_PANEL_HEIGHT = "calc(100vh - 96px)";

/**
 * The report's preview: an empty state until it is asked for, then the PDF
 * (rendered in a worker, so the page stays responsive), its error with a retry,
 * and a notice when the choice changed since.
 */
export const ReportPreviewPanel: React.FC = () => {
  const { t } = useTranslation();
  const {
    previewUrl,
    previewState,
    isPreviewStale,
    previewInfo,
    retryPreview,
  } = useContext(ReportContext);
  // The notice's button asks as "Generar vista previa" does, and is off as it is
  const { missing, request } = useReportPreviewRequest();

  // One notice about the shown PDF: a large report previews its first farm and
  // downloads as a ZIP, and above the satellite limit every map goes without it.
  const withoutSatellite = previewInfo?.satelliteLimit != null;
  const notice = !previewInfo
    ? null
    : previewInfo.isLarge
      ? t(
          withoutSatellite
            ? "reportGeneration:preview:largeReportWithoutSatellite"
            : "reportGeneration:preview:largeReport",
          { count: previewInfo.farmCount }
        )
      : withoutSatellite
        ? t("reportGeneration:preview:withoutSatellite", {
            limit: previewInfo.satelliteLimit,
          })
        : null;

  return (
    <Box
      component="section"
      aria-label={t("reportGeneration:preview:title")}
      sx={{
        ...STAGE_CARD,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: { xs: "75vh", md: PREVIEW_PANEL_HEIGHT },
        minHeight: 420,
        position: { md: "sticky" },
        top: { md: 80 },
      }}
    >
      {/* Always in the page, so screen readers hear the notice when it appears */}
      <Box role="status" data-testid="stale-announcer" sx={VISUALLY_HIDDEN}>
        {isPreviewStale &&
          [
            t("reportGeneration:preview.stale"),
            missing && t(`reportGeneration:actions.${missing}`),
          ]
            .filter(Boolean)
            .join(" ")}
      </Box>
      {isPreviewStale && (
        <Box
          data-testid="stale-notice"
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1.5,
            padding: "10px 16px",
            backgroundColor: FLOW_COLORS.blue50,
            color: FLOW_COLORS.ink,
            fontSize: 14,
          }}
        >
          <InfoOutlinedIcon fontSize="small" sx={{ color: FLOW_COLORS.blue }} aria-hidden />
          {/* Announced by the status above; the button is described by the reason */}
          <Box component="span" aria-hidden sx={{ flex: 1, minWidth: 200 }}>
            {t("reportGeneration:preview.stale")}
            {missing && (
              <Box
                component="span"
                id="report-stale-reason"
                sx={{ display: "block", fontSize: 13, color: FLOW_COLORS.muted }}
              >
                {t(`reportGeneration:actions.${missing}`)}
              </Box>
            )}
          </Box>
          <Button
            size="small"
            variant="contained"
            onClick={request}
            disabled={!!missing}
            aria-describedby={missing ? "report-stale-reason" : undefined}
          >
            {t("reportGeneration:actions.updatePreview")}
          </Button>
        </Box>
      )}
      {notice && previewState === "ready" && (
        <Alert severity="info" sx={{ borderRadius: 0 }}>
          {notice}
        </Alert>
      )}
      <Box
        sx={{
          flexGrow: 1,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: FLOW_COLORS.blue25,
        }}
      >
        {previewState === "idle" && (
          <Box sx={{ textAlign: "center", maxWidth: 360, padding: 3, color: FLOW_COLORS.muted }}>
            <DescriptionOutlinedIcon sx={{ fontSize: 56, color: FLOW_COLORS.line }} aria-hidden />
            <Box
              component="p"
              sx={{ margin: 0, marginTop: 1, fontWeight: 700, color: FLOW_COLORS.ink }}
            >
              {t("reportGeneration:preview.emptyTitle")}
            </Box>
            <Box component="p" sx={{ margin: 0, marginTop: 0.5, fontSize: 14 }}>
              {t("reportGeneration:preview.emptyDescription")}
            </Box>
          </Box>
        )}
        {previewState === "ready" && previewUrl && (
          <iframe
            // No toolbar, like the previous <PDFViewer showToolbar={false}>.
            src={`${previewUrl}#toolbar=0`}
            title={t("reportGeneration:preview:title")}
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        )}
        {previewState === "loading" && (
          <Box
            role="status"
            sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
          >
            <CircularProgress size={64} />
            <Box component="span" sx={{ fontSize: 14, color: FLOW_COLORS.muted }}>
              {t("reportGeneration:preview.loading")}
            </Box>
          </Box>
        )}
        {previewState === "failed" && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={retryPreview}>
                {t("reportGeneration:preview:retry")}
              </Button>
            }
          >
            {t("reportGeneration:preview:error")}
          </Alert>
        )}
      </Box>
    </Box>
  );
};
