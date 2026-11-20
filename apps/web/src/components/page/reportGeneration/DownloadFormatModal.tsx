"use client";

import { useCallback, useContext, useRef, useState } from "react";
import { Box, Button } from "@mui/material";
import RadioButtonCheckedRoundedIcon from "@mui/icons-material/RadioButtonCheckedRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import { useTranslation } from "react-i18next";
import { BaseModal } from "@/components/reusable/BaseModal";
import { DataContext } from "@/context/DataContext";
import { ReportContext } from "@/context/ReportContext";
import { SnackbarContext } from "@/context/SnackbarContext";
import { useReportDownload } from "@/hooks/useReportDownload";
import { useGeoJsonDownload } from "@/hooks/useGeoJsonDownload";
import { useVisibleDataForAnalysisPage } from "@/hooks/useVisibleDataForAnalysisPage";
import { generateGeoJsonFarmsDataWithLayerAnalysis } from "@/utils/geojson";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { formatNumber } from "@/utils/numbers";
import { AS_TEXT } from "@/utils/asText";

type Format = "combined" | "separated";
const FORMATS: Format[] = ["combined", "separated"];

interface CardProps {
  title: string;
  description: string;
  checked: boolean;
  /** A radio of a group; a fixed card (the only format) is not. */
  radio?: { tabIndex: number; onSelect: () => void };
}

const FormatCard: React.FC<CardProps> = ({ title, description, checked, radio }) => (
  <Box
    role={radio ? "radio" : undefined}
    aria-checked={radio ? checked : undefined}
    tabIndex={radio?.tabIndex}
    data-format-card
    onClick={radio?.onSelect}
    onKeyDown={(event) => {
      if (radio && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        radio.onSelect();
      }
    }}
    sx={{
      display: "flex",
      alignItems: "flex-start",
      gap: 1.25,
      padding: "14px 16px",
      borderRadius: "12px",
      border: "1.5px solid",
      borderColor: checked ? FLOW_COLORS.blue : FLOW_COLORS.line,
      backgroundColor: checked ? FLOW_COLORS.blue25 : FLOW_COLORS.white,
      cursor: radio ? "pointer" : "default",
      outline: "none",
      "&:focus-visible": { boxShadow: `0 0 0 3px ${FLOW_COLORS.blue50}` },
    }}
  >
    <Box aria-hidden sx={{ color: checked ? FLOW_COLORS.blue : FLOW_COLORS.muted, lineHeight: 0 }}>
      {checked ? <RadioButtonCheckedRoundedIcon /> : <RadioButtonUncheckedRoundedIcon />}
    </Box>
    <Box>
      <Box component="span" sx={{ display: "block", fontWeight: 700, color: FLOW_COLORS.ink }}>
        {title}
      </Box>
      <Box component="span" sx={{ display: "block", fontSize: 14, color: FLOW_COLORS.muted }}>
        {description}
      </Box>
    </Box>
  </Box>
);

interface Props {
  isOpen: boolean;
  handleClose: () => void;
  /** A large report's ZIP: built farm by farm by the page, with its progress. */
  onDownloadLargeReport: () => void;
}

/**
 * "Formato": how to download the current choice. Several farms choose one PDF or
 * a PDF per farm; one farm has no choice; a large report is a ZIP only, and says
 * why. Every case also offers the choice's GeoJSON.
 */
export const DownloadFormatModal: React.FC<Props> = ({
  isOpen,
  handleClose,
  onDownloadLargeReport,
}) => {
  const { t, i18n } = useTranslation();
  const {
    reportGenerationParams: { selectedFarms, selectedMaps, downloadType },
    setReportGenerationParams,
    availableCategories,
  } = useContext(DataContext);
  const { isLarge, farmCount } = useContext(ReportContext);
  const { territorialAnalysisResults } = useVisibleDataForAnalysisPage();
  const { openSnackbar } = useContext(SnackbarContext);
  const { downloadCompleteReport, downloadSeparatedReports } = useReportDownload();
  const downloadGeoJson = useGeoJsonDownload();
  const [isDownloading, setIsDownloading] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  const single = selectedFarms.length === 1;
  const format: Format = downloadType ?? "combined";
  const setFormat = useCallback(
    (value: Format) =>
      setReportGenerationParams((prev) => ({ ...prev, downloadType: value })),
    [setReportGenerationParams]
  );

  const onDownloadPdf = useCallback(async () => {
    if (isLarge) {
      handleClose();
      onDownloadLargeReport();
      return;
    }
    setIsDownloading(true);
    if (single || format === "combined") await downloadCompleteReport();
    else await downloadSeparatedReports();
    setIsDownloading(false);
    handleClose();
  }, [
    isLarge,
    single,
    format,
    handleClose,
    onDownloadLargeReport,
    downloadCompleteReport,
    downloadSeparatedReports,
  ]);

  const onDownloadGeoJson = useCallback(() => {
    try {
      const reportLayers = new Set(selectedMaps.map(({ id }) => id));
      downloadGeoJson(
        generateGeoJsonFarmsDataWithLayerAnalysis(
          selectedFarms,
          territorialAnalysisResults.filter(({ mapId }) => reportLayers.has(mapId)),
          selectedMaps,
          availableCategories,
          t,
          i18n.language
        ),
        "report.geojson"
      );
    } catch (error) {
      console.error("Error generating GeoJSON:", error);
      openSnackbar({
        message: t("common:snackbarAlerts:errorParsingDataForGeoJson"),
        type: "error",
      });
    }
  }, [
    selectedFarms,
    selectedMaps,
    territorialAnalysisResults,
    availableCategories,
    downloadGeoJson,
    openSnackbar,
    t,
    i18n.language,
  ]);

  // Arrow keys move the choice, and the focus with it (one Tab stop).
  const onGroupKeyDown = (event: React.KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[
      event.key as "ArrowDown"
    ];
    if (!step) return;
    event.preventDefault();
    const next = FORMATS[(FORMATS.indexOf(format) + step + FORMATS.length) % FORMATS.length];
    setFormat(next);
    const cards = groupRef.current?.querySelectorAll<HTMLElement>("[data-format-card]");
    cards?.[FORMATS.indexOf(next)]?.focus();
  };

  const text = (key: string, options?: Record<string, unknown>) =>
    t(`reportGeneration:downloadFormatModal.${key}`, options);

  return (
    <BaseModal
      isOpen={isOpen}
      handleClose={handleClose}
      title={text("title")}
      maxWidth="sm"
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {isLarge ? (
          <FormatCard
            title={text("separated.title")}
            description={text("large", { amount: formatNumber(farmCount) })}
            checked
          />
        ) : single ? (
          <FormatCard
            title={text("single.title")}
            description={text("single.description", { id: selectedFarms[0].id, ...AS_TEXT })}
            checked
          />
        ) : (
          <Box
            ref={groupRef}
            role="radiogroup"
            aria-label={text("title")}
            onKeyDown={onGroupKeyDown}
            sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
          >
            {FORMATS.map((value) => (
              <FormatCard
                key={value}
                title={text(`${value}.title`)}
                description={text(`${value}.description`, {
                  amount: formatNumber(selectedFarms.length),
                })}
                checked={format === value}
                radio={{
                  tabIndex: format === value ? 0 : -1,
                  onSelect: () => setFormat(value),
                }}
              />
            ))}
          </Box>
        )}
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 1.5,
          marginTop: 3,
        }}
      >
        <Button variant="outlined" onClick={onDownloadGeoJson}>
          {text("downloadGeoJson")}
        </Button>
        <Button variant="contained" onClick={onDownloadPdf} loading={isDownloading}>
          {isLarge
            ? t("reportGeneration:buttons:downloadZip", { count: farmCount })
            : text("downloadPdf")}
        </Button>
      </Box>
    </BaseModal>
  );
};
