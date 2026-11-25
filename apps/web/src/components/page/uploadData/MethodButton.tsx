"use client";

import { Box, ButtonBase } from "@mui/material";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS, HEADING_FONT } from "@/components/page/flow/flowStyles";

// The methods not picked look muted, like a disabled control, but stay clickable:
// hovering one brings its colors back. Texts keep 4.5:1 and the icon 3:1 on their
// backgrounds.
const IDLE = {
  background: "#f5f7f9",
  line: "#e6ebf0",
  title: "#56687a",
  description: "#5f7184",
  iconBackground: "#eceff3",
  icon: "#7a8a99",
} as const;

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
        border: `1.5px solid ${selected ? FLOW_COLORS.blue : IDLE.line}`,
        backgroundColor: selected ? FLOW_COLORS.blue25 : IDLE.background,
        boxShadow: selected ? "0 0 0 3px rgba(13, 100, 160, 0.08)" : "none",
        transition: "border-color .15s, background-color .15s",
        "& .method-icon": {
          backgroundColor: selected ? FLOW_COLORS.blue50 : IDLE.iconBackground,
          color: selected ? FLOW_COLORS.blue : IDLE.icon,
          transition: "background-color .15s, color .15s",
        },
        "& .method-title": { color: selected ? FLOW_COLORS.ink : IDLE.title },
        "& .method-description": { color: selected ? FLOW_COLORS.muted : IDLE.description },
        "&:hover": selected
          ? { borderColor: FLOW_COLORS.blue }
          : {
              borderColor: "#b9d3e8",
              backgroundColor: FLOW_COLORS.white,
              "& .method-icon": { backgroundColor: FLOW_COLORS.blue50, color: FLOW_COLORS.blue },
              "& .method-title": { color: FLOW_COLORS.ink },
              "& .method-description": { color: FLOW_COLORS.muted },
            },
        "&.Mui-focusVisible": { outline: `2px solid ${FLOW_COLORS.blue}`, outlineOffset: 2 },
      }}
    >
      <Box
        aria-hidden
        className="method-icon"
        sx={{
          width: 34,
          height: 34,
          borderRadius: "9px",
          display: "grid",
          placeItems: "center",
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
        }}
        className="method-title"
      >
        {title}
      </Box>
      <Box
        component="span"
        className="method-description"
        sx={{ fontSize: 12.5, lineHeight: 1.35 }}
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
