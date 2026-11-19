"use client";

import { Box, ButtonBase } from "@mui/material";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useTranslation } from "react-i18next";
import { FLOW_COLORS, FOREST_IMAGE } from "@/components/page/flow/flowStyles";

/** The "Dibujar en el mapa" method's control: the whole area opens the map. */
export const DrawArea: React.FC<{ disabled?: boolean; onClick: () => void }> = ({
  disabled,
  onClick,
}) => {
  const { t } = useTranslation();
  return (
    // The whole area opens the map: it is one button, named by its text.
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        flexGrow: 1,
        minHeight: 160,
        borderRadius: "12px",
        border: `1.5px dashed #a9c4dc`,
        background: `linear-gradient(rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.55)), url(${FOREST_IMAGE}) center / cover`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        padding: "22px",
        textAlign: "center",
        transition: "border-color .15s",
        "&:hover": { borderColor: FLOW_COLORS.blue },
        "&.Mui-focusVisible": {
          outline: `2px solid ${FLOW_COLORS.blue}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          backgroundColor: FLOW_COLORS.blue50,
          color: FLOW_COLORS.blue,
        }}
      >
        <EditOutlinedIcon />
      </Box>
      <Box component="b" sx={{ color: FLOW_COLORS.ink, fontSize: 14 }}>
        {t("common:farmsUpload:drawTitle")}
      </Box>
      {/* Looks like a button; the whole area is the control */}
      <Box
        component="span"
        aria-hidden
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          borderRadius: "8px",
          padding: "5px 12px",
          fontSize: 13,
          fontWeight: 600,
          color: FLOW_COLORS.white,
          backgroundColor: FLOW_COLORS.blue,
        }}
      >
        <AddLocationAltOutlinedIcon sx={{ fontSize: 18 }} />
        {t("common:farmsUpload:openMap")}
      </Box>
    </ButtonBase>
  );
};
