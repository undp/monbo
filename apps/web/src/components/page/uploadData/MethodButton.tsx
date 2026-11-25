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
        // A method not picked looks muted, like a disabled control, but stays
        // clickable: hovering it brings its colors back
        border: `1.5px solid ${selected ? FLOW_COLORS.blue : FLOW_COLORS.idleLine}`,
        backgroundColor: selected ? FLOW_COLORS.blue25 : FLOW_COLORS.idleBackground,
        boxShadow: selected ? "0 0 0 3px rgba(13, 100, 160, 0.08)" : "none",
        transition: "border-color .15s, background-color .15s",
        "& .method-icon": {
          backgroundColor: selected ? FLOW_COLORS.blue50 : FLOW_COLORS.idleIconBackground,
          color: selected ? FLOW_COLORS.blue : FLOW_COLORS.idleIcon,
          transition: "background-color .15s, color .15s",
        },
        "& .method-title": { color: selected ? FLOW_COLORS.ink : FLOW_COLORS.idleTitle },
        "& .method-description": {
          color: selected ? FLOW_COLORS.muted : FLOW_COLORS.idleText,
        },
        "&:hover": selected
          ? { borderColor: FLOW_COLORS.blue }
          : {
              borderColor: FLOW_COLORS.blueLine,
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
