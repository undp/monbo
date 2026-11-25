"use client";

import React from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, ToggleButton, ToggleButtonGroup } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { MIN_POLYGON_VERTICES } from "@/utils/drawing";
import { FarmDrawing } from "./useFarmDrawing";

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
        >
          <ToggleButton value="polygon">
            {t("manualFarm:geometry:polygon")}
          </ToggleButton>
          <ToggleButton value="point">
            {t("manualFarm:geometry:point")}
          </ToggleButton>
        </ToggleButtonGroup>
        <Button
          size="small"
          startIcon={<InfoOutlinedIcon />}
          onClick={onHowTo}
          sx={{ textTransform: "none" }}
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
          minHeight: 31,
        }}
      >
        {polygon?.open && (
          <Button
            size="small"
            variant="contained"
            onClick={farm.finish}
            disabled={polygon.open.vertices.length < MIN_POLYGON_VERTICES}
          >
            {t("manualFarm:actions:finish")}
          </Button>
        )}
        {polygon?.open && polygon.parts.length > 0 && (
          <Button size="small" onClick={farm.discardRing}>
            {t(`manualFarm:actions:discard:${polygon.open.kind}`)}
          </Button>
        )}
        {polygon && !polygon.open && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => farm.addRing("part")}
            >
              {t("manualFarm:actions:addPart")}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => farm.addRing("hole")}
            >
              {t("manualFarm:actions:addHole")}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={() => selectedVertex && farm.removeVertex(selectedVertex)}
              disabled={!selectedVertex}
            >
              {t("manualFarm:actions:deleteVertex")}
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={farm.removeSelectedRing}
              disabled={!selectedRing}
            >
              {t(
                selectedRing && selectedRing.hole !== null
                  ? "manualFarm:actions:deleteHole"
                  : "manualFarm:actions:deletePart"
              )}
            </Button>
          </>
        )}
        <Button size="small" onClick={farm.startOver} disabled={!farm.drawing}>
          {t("manualFarm:actions:startOver")}
        </Button>
      </Box>
    </>
  );
};
