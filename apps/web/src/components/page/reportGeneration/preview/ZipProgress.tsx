"use client";

import { Box, Button, CircularProgress, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

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
    <Paper
      elevation={8}
      role="status"
      aria-live="polite"
      sx={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: (theme) => theme.zIndex.modal,
        width: 360,
        padding: 4,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        textAlign: "center",
      }}
    >
      <Typography variant="h6">
        {t("reportGeneration:zipProgress:title")}
      </Typography>
      <Box sx={{ position: "relative", display: "inline-flex" }}>
        {/* The track, so the ring reads as progress out of 100%. */}
        <CircularProgress
          variant="determinate"
          value={100}
          size={112}
          sx={{ color: "grey.200", position: "absolute" }}
          aria-hidden
        />
        <CircularProgress variant="determinate" value={percent} size={112} />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography variant="h5" component="span">
            {`${percent}%`}
          </Typography>
        </Box>
      </Box>
      <Typography variant="body1">
        {t("reportGeneration:zipProgress:count", { done, total })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("reportGeneration:zipProgress:hint")}
      </Typography>
      <Button variant="outlined" onClick={onCancel}>
        {t("common:cancel")}
      </Button>
    </Paper>
  );
};
