"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import PentagonOutlinedIcon from "@mui/icons-material/PentagonOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { MIN_POLYGON_VERTICES } from "@/utils/drawing";
import { PRIMARY_BUTTON, SECONDARY_BUTTON, TEXT_BUTTON } from "./manualFarmStyles";
import { FarmDrawing } from "./useFarmDrawing";

// The polygon/point switch: a segmented control, the chosen mode white on the track
const MODE_SWITCH = {
  padding: "3px",
  gap: "2px",
  borderRadius: "10px",
  backgroundColor: FLOW_COLORS.blue50,
  "& .MuiToggleButton-root": {
    gap: 0.75,
    padding: "5px 14px",
    border: "none",
    // Each button keeps its own round corners inside the group
    borderRadius: "8px !important",
    textTransform: "none",
    fontSize: 14,
    fontWeight: 600,
    color: FLOW_COLORS.ink2,
    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.6)" },
    "&.Mui-selected, &.Mui-selected:hover": {
      color: FLOW_COLORS.blue,
      backgroundColor: FLOW_COLORS.white,
      boxShadow: "0 1px 2px rgba(11, 37, 69, 0.12)",
    },
  },
} as const;

// One height for every action, framed or not: the map below must not move as they change
const SMALL = { height: 32, padding: "0 12px", fontSize: 13.5 } as const;

/**
 * The buttons above the map, in two rows from the start so the map doesn't move as
 * the actions change: the mode and "How to draw?", then the drawing's actions.
 */
export const DrawingToolbar: React.FC<{
  farm: FarmDrawing;
  onHowTo: () => void;
}> = ({ farm, onHowTo }) => {
  const { t } = useTranslation();
  const { polygon, selectedVertex } = farm;
  const selectedRing =
    selectedVertex && selectedVertex.ring !== "open"
      ? selectedVertex.ring
      : null;

  return (
    <>
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={farm.mode}
          onChange={(_, next) => farm.changeMode(next)}
          aria-label={t("manualFarm:geometry:label")}
          sx={MODE_SWITCH}
        >
          <ToggleButton value="polygon">
            <PentagonOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
            {t("manualFarm:geometry:polygon")}
          </ToggleButton>
          <ToggleButton value="point">
            <PlaceOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
            {t("manualFarm:geometry:point")}
          </ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          startIcon={<InfoOutlinedIcon />}
          onClick={onHowTo}
          sx={{ ...TEXT_BUTTON, color: FLOW_COLORS.blue, fontSize: 14 }}
        >
          {t("manualFarm:howTo:button")}
        </Button>
      </Box>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1,
          alignItems: "center",
          minHeight: 32,
        }}
      >
        {polygon?.open && (
          <Button
            size="small"
            variant="contained"
            onClick={farm.finish}
            disabled={polygon.open.vertices.length < MIN_POLYGON_VERTICES}
            sx={{ ...PRIMARY_BUTTON, ...SMALL }}
          >
            {t("manualFarm:actions:finish")}
          </Button>
        )}
        {polygon?.open && polygon.parts.length > 0 && (
          <Button size="small" onClick={farm.discardRing} sx={{ ...TEXT_BUTTON, ...SMALL }}>
            {t(`manualFarm:actions:discard:${polygon.open.kind}`)}
          </Button>
        )}
        {polygon && !polygon.open && (
          <>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => farm.addRing("part")}
              sx={{ ...SECONDARY_BUTTON, ...SMALL }}
            >
              {t("manualFarm:actions:addPart")}
            </Button>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => farm.addRing("hole")}
              sx={{ ...SECONDARY_BUTTON, ...SMALL }}
            >
              {t("manualFarm:actions:addHole")}
            </Button>
            <Button
              size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => selectedVertex && farm.removeVertex(selectedVertex)}
              disabled={!selectedVertex}
              sx={{ ...SECONDARY_BUTTON, ...SMALL }}
            >
              {t("manualFarm:actions:deleteVertex")}
            </Button>
            <Button
              size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={farm.removeSelectedRing}
              disabled={!selectedRing}
              sx={{ ...SECONDARY_BUTTON, ...SMALL }}
            >
              {t(
                selectedRing && selectedRing.hole !== null
                  ? "manualFarm:actions:deleteHole"
                  : "manualFarm:actions:deletePart"
              )}
            </Button>
          </>
        )}
        <Button
          size="small"
          startIcon={<RestartAltIcon />}
          onClick={farm.startOver}
          disabled={!farm.drawing}
          sx={{ ...TEXT_BUTTON, ...SMALL, marginLeft: "auto" }}
        >
          {t("manualFarm:actions:startOver")}
        </Button>
      </Box>
    </>
  );
};
