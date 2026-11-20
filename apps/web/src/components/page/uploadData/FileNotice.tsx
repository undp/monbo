"use client";

import { Box, Button } from "@mui/material";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import {
  ManualSource,
  UploadSource,
  isMissingData,
  sourceErrors,
  sourceProblem,
  sourceRows,
} from "@/utils/uploadSources";

interface FileNoticeProps {
  source: Exclude<UploadSource, ManualSource>;
  onRemove: () => void;
  onShowErrors: () => void;
  onAttachExcel: () => void;
  onDetachExcel: () => void;
}

/**
 * A listed file, above its farms' rows: its name, its farms or its problem, and
 * what applies to the whole file (show errors, attach or remove the Excel, remove
 * the file). A file with problems stands out; one without them is a plain line.
 */
export const FileNotice: React.FC<FileNoticeProps> = ({
  source,
  onRemove,
  onShowErrors,
  onAttachExcel,
  onDetachExcel,
}) => {
  const { t } = useTranslation();
  const errors = sourceErrors(source);
  const problem = sourceProblem(source, t);
  const geoExcel = source.kind === "geo" ? source.excel : null;
  const missingData = isMissingData(source);
  const tone = problem ? (missingData ? "warn" : "bad") : "neutral";
  const colors = {
    warn: { text: FLOW_COLORS.warn, background: FLOW_COLORS.warnBackground },
    bad: { text: FLOW_COLORS.bad, background: FLOW_COLORS.badBackground },
    neutral: { text: FLOW_COLORS.ink2, background: FLOW_COLORS.blue25 },
  }[tone];

  const count = t("common:farmsUpload:farmCount", {
    count: sourceRows(source).length,
  });
  const detail =
    problem ??
    (geoExcel
      ? `${count} · ${t("common:farmsUpload:joinedWith", {
          name: geoExcel.name,
          interpolation: { escapeValue: false },
        })}`
      : count);
  // Every file has these buttons: the name says which file each one acts on
  const named = (action: string) =>
    t("common:farmsUpload:notice:actionOn", {
      action,
      name: source.name,
      interpolation: { escapeValue: false },
    });
  const Icon =
    tone === "warn"
      ? WarningAmberRoundedIcon
      : tone === "bad"
        ? ErrorOutlineRoundedIcon
        : InsertDriveFileOutlinedIcon;

  return (
    <Box
      role={problem ? "alert" : undefined}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 1.5,
        rowGap: 0.75,
        padding: "10px 14px",
        borderRadius: "10px",
        backgroundColor: colors.background,
        border: `1px solid ${tone === "neutral" ? FLOW_COLORS.line : "transparent"}`,
      }}
    >
      <Icon aria-hidden sx={{ fontSize: 20, color: colors.text }} />
      <Box sx={{ flex: "1 1 260px", minWidth: 0, fontSize: 14 }}>
        <Box component="b" sx={{ color: FLOW_COLORS.ink, wordBreak: "break-word" }}>
          {source.name}
        </Box>
        <Box component="span" sx={{ color: colors.text }}>
          {" · "}
          {detail}
        </Box>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 0.5,
          marginLeft: "auto",
        }}
      >
        {errors.length > 1 && (
          <Button
            size="small"
            onClick={onShowErrors}
            aria-label={named(t("common:farmsUpload:showErrors"))}
          >
            {t("common:farmsUpload:showErrors")}
          </Button>
        )}
        {geoExcel && (
          <Button
            size="small"
            onClick={onDetachExcel}
            aria-label={named(t("common:farmsUpload:removeExcel"))}
          >
            {t("common:farmsUpload:removeExcel")}
          </Button>
        )}
        {missingData && (
          <Button
            size="small"
            variant="outlined"
            onClick={onAttachExcel}
            aria-label={named(t("common:farmsUpload:attachExcel"))}
          >
            {t("common:farmsUpload:attachExcel")}
          </Button>
        )}
        <Button
          size="small"
          color="inherit"
          onClick={onRemove}
          aria-label={named(t("common:farmsUpload:removeFile"))}
        >
          {t("common:farmsUpload:removeFile")}
        </Button>
      </Box>
    </Box>
  );
};
