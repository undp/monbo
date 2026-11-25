"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";

/**
 * The heading of the manual farm modal and of its "How to draw" dialog, as a stage
 * page's section: an icon tile, the title and a line under it, and the close button.
 * Only the title is the `DialogTitle`, which names the dialog: the subtitle goes in
 * `subtitleId`, for the Dialog's `aria-describedby`.
 */
export const ModalHeader: React.FC<{
  title: string;
  subtitle?: string;
  subtitleId?: string;
  icon: React.ReactNode;
  onClose: () => void;
}> = ({ title, subtitle, subtitleId, icon, onClose }) => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        padding: { xs: "16px 56px 16px 16px", md: "18px 64px 18px 24px" },
        borderBottom: `1px solid ${FLOW_COLORS.line}`,
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 40,
          height: 40,
          flex: "none",
          borderRadius: "10px",
          display: "grid",
          placeItems: "center",
          backgroundColor: FLOW_COLORS.blue50,
          color: FLOW_COLORS.blue,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <DialogTitle
          component="h2"
          sx={{
            margin: 0,
            padding: 0,
            fontFamily: HEADING_FONT,
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.015em",
            color: FLOW_COLORS.ink,
          }}
        >
          {title}
        </DialogTitle>
        {subtitle && (
          <Box
            component="p"
            id={subtitleId}
            sx={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: FLOW_COLORS.muted }}
          >
            {subtitle}
          </Box>
        )}
      </Box>
      <IconButton
        aria-label={t("manualFarm:close")}
        onClick={onClose}
        sx={{
          position: "absolute",
          right: { xs: 8, md: 16 },
          top: "50%",
          transform: "translateY(-50%)",
          color: FLOW_COLORS.muted,
        }}
      >
        <CloseIcon />
      </IconButton>
    </Box>
  );
};
