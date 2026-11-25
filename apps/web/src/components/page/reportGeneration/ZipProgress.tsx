"use client";

import { Box, Button, CircularProgress } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS, HEADING_FONT, STAGE_CARD } from "@/components/page/flow/flowStyles";

interface ZipProgressProps {
  done: number;
  total: number;
  onCancel: () => void;
}

/**
 * A large report's ZIP being built: centered over the page, with the farms done
 * and the percentage. It doesn't block the page; leaving it cancels the job.
 */
export const ZipProgress: React.FC<ZipProgressProps> = ({
  done,
  total,
  onCancel,
}) => {
  const { t } = useTranslation();
  const percent = Math.floor((done / Math.max(total, 1)) * 100);

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: (theme) => theme.zIndex.modal,
        ...STAGE_CARD,
        borderRadius: "16px",
        boxShadow: "0 24px 60px rgba(11, 37, 69, 0.22)",
        width: 360,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        textAlign: "center",
      }}
    >
      <Box
        component="h2"
        sx={{
          margin: 0,
          fontFamily: HEADING_FONT,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: FLOW_COLORS.ink,
        }}
      >
        {t("reportGeneration:zipProgress:title")}
      </Box>
      <Box sx={{ position: "relative", display: "inline-flex" }}>
        {/* The track, so the ring reads as progress out of 100%. */}
        <CircularProgress
          variant="determinate"
          value={100}
          size={112}
          sx={{ color: FLOW_COLORS.blue50, position: "absolute" }}
          aria-hidden
        />
        <CircularProgress
          variant="determinate"
          value={percent}
          size={112}
          sx={{ color: FLOW_COLORS.blue }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            component="span"
            sx={{ fontFamily: HEADING_FONT, fontSize: 26, fontWeight: 700, color: FLOW_COLORS.ink }}
          >
            {`${percent}%`}
          </Box>
        </Box>
      </Box>
      <Box component="p" sx={{ margin: 0, fontSize: 15, color: FLOW_COLORS.ink }}>
        {t("reportGeneration:zipProgress:count", { done, total })}
      </Box>
      <Box component="p" sx={{ margin: 0, fontSize: 13.5, color: FLOW_COLORS.ink2 }}>
        {t("reportGeneration:zipProgress:hint")}
      </Box>
      <Button variant="outlined" onClick={onCancel}>
        {t("common:cancel")}
      </Button>
    </Box>
  );
};
