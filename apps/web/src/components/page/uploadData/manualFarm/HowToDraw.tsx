"use client";

import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

// The size of the "How to draw" GIFs (public/images/manual-farm-drawing-*.gif),
// recorded from the modal's map at its own size by scripts/record-drawing-gif.mjs
const HOW_TO_GIF = { width: 768, height: 542 };

/** A larger animation of drawing a polygon, with its steps, opened from the
 * drawing toolbar's "How to draw?" button. */
export const HowToDraw: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === "en" ? "en" : "es";
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ paddingRight: 6 }}>
        {t("manualFarm:howTo:title")}
        <IconButton
          aria-label={t("manualFarm:close")}
          onClick={onClose}
          sx={{ position: "absolute", top: 8, right: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Image
          src={`/images/manual-farm-drawing-${language}.gif`}
          alt={t("manualFarm:howTo:alt")}
          width={HOW_TO_GIF.width}
          height={HOW_TO_GIF.height}
          // Served as is: Next's optimizer doesn't resize animated images
          unoptimized
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            borderRadius: 8,
          }}
        />
        <Box component="ol" sx={{ marginBottom: 0, paddingLeft: 2.5 }}>
          {(["1", "2", "3", "4", "5", "6"] as const).map((step) => (
            <Typography component="li" variant="body2" key={step}>
              {t(`manualFarm:howTo:steps:${step}`)}
            </Typography>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
