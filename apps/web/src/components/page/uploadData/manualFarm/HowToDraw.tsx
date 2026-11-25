"use client";

import React from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { Box, Dialog, DialogContent } from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { MODAL_PAPER } from "./manualFarmStyles";
import { ModalHeader } from "./ModalHeader";

// The size of the "How to draw" GIFs (public/images/manual-farm-drawing-*.gif),
// recorded from the modal's map at its own size by scripts/record-drawing-gif.mjs
const HOW_TO_GIF = { width: 768, height: 545 };

/** A larger animation of drawing a polygon, with its steps, opened from the
 * drawing toolbar's "How to draw?" button. */
export const HowToDraw: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === "en" ? "en" : "es";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: MODAL_PAPER } }}
    >
      <ModalHeader
        title={t("manualFarm:howTo:title")}
        icon={<InfoOutlinedIcon />}
        onClose={onClose}
      />
      <DialogContent sx={{ padding: { xs: 2, md: 3 } }}>
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
            borderRadius: 12,
            border: `1px solid ${FLOW_COLORS.line}`,
          }}
        />
        {/* The "how to" panel's list: in order, with the stage pages' chevrons */}
        <Box
          component="ol"
          sx={{
            margin: "20px 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            // Two columns read top to bottom, as the steps go
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gridTemplateRows: { md: "repeat(3, auto)" },
            gridAutoFlow: { md: "column" },
            columnGap: 3,
            rowGap: 1.25,
          }}
        >
          {(["1", "2", "3", "4", "5", "6"] as const).map((step) => (
            <Box
              component="li"
              key={step}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
                fontSize: 14,
                lineHeight: 1.5,
                color: FLOW_COLORS.ink2,
              }}
            >
              <ChevronRightRoundedIcon
                aria-hidden
                sx={{ fontSize: 18, marginTop: "2px", color: FLOW_COLORS.leafDark }}
              />
              {t(`manualFarm:howTo:steps:${step}`)}
            </Box>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
};
