"use client";

import { Box, ButtonBase } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";

interface MethodButtonProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  /** Farms already listed from this method */
  loaded: number;
  selected: boolean;
  onClick: () => void;
}

/** One way to upload: picking it shows its steps and its control below. */
export const MethodButton: React.FC<MethodButtonProps> = ({
  icon,
  title,
  description,
  loaded,
  selected,
  onClick,
}) => {
  const { t } = useTranslation();
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 0.75,
        padding: "14px",
        textAlign: "left",
        borderRadius: "12px",
        border: `1.5px solid ${selected ? FLOW_COLORS.blue : FLOW_COLORS.line}`,
        backgroundColor: selected ? FLOW_COLORS.blue25 : FLOW_COLORS.white,
        boxShadow: selected ? "0 0 0 3px rgba(13, 100, 160, 0.08)" : "none",
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: selected ? FLOW_COLORS.blue : "#b9d3e8" },
        "&.Mui-focusVisible": { outline: `2px solid ${FLOW_COLORS.blue}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 34,
          height: 34,
          borderRadius: "9px",
          display: "grid",
          placeItems: "center",
          backgroundColor: FLOW_COLORS.blue50,
          color: FLOW_COLORS.blue,
        }}
      >
        {icon}
      </Box>
      <Box
        component="span"
        sx={{
          fontFamily: HEADING_FONT,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.2,
          color: FLOW_COLORS.ink,
        }}
      >
        {title}
      </Box>
      <Box
        component="span"
        sx={{ fontSize: 12.5, lineHeight: 1.35, color: FLOW_COLORS.muted }}
      >
        {description}
      </Box>
      {loaded > 0 && (
        <Box
          component="span"
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "inline-flex",
            alignItems: "center",
            borderRadius: 999,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            color: FLOW_COLORS.ok,
            backgroundColor: FLOW_COLORS.okBackground,
          }}
        >
          {t("common:farmsUpload:loadedCount", { count: loaded })}
        </Box>
      )}
    </ButtonBase>
  );
};
