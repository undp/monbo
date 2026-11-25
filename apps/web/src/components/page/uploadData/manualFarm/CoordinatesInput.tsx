"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, TextField } from "@mui/material";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import { FLOW_COLORS } from "@/components/page/flow/flowStyles";
import { Coordinates } from "@/interfaces/Map";
import { EYEBROW, FIELD, SECONDARY_BUTTON } from "./manualFarmStyles";

interface CoordinatesInputProps {
  // "Go": the map moves to the typed position
  onGo: (position: Coordinates) => void;
  // "Add point": whether the typed position was accepted as a vertex or the point
  onAdd: (position: Coordinates) => boolean;
  addDisabled: boolean;
}

/**
 * A latitude and longitude typed in, to move the map there or to add a vertex (or
 * the point) at known coordinates. After an accepted vertex the fields empty for
 * the next one; a rejected one stays typed, to fix it.
 */
export const CoordinatesInput: React.FC<CoordinatesInputProps> = ({
  onGo,
  onAdd,
  addDisabled,
}) => {
  const { t } = useTranslation();
  const [typed, setTyped] = useState({ lat: "", lng: "", invalid: false });

  // The typed latitude and longitude, or null after marking them invalid
  const position = (): Coordinates | null => {
    const lat = parseCoordinate(typed.lat);
    const lng = parseCoordinate(typed.lng);
    if (
      lat === null ||
      lng === null ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      setTyped((current) => ({ ...current, invalid: true }));
      return null;
    }
    setTyped((current) => ({ ...current, invalid: false }));
    return { lat, lng };
  };

  const go = () => {
    const center = position();
    if (center) onGo(center);
  };

  const add = () => {
    const vertex = position();
    if (vertex && onAdd(vertex)) setTyped({ lat: "", lng: "", invalid: false });
  };

  const field = (key: "lat" | "lng", label: string) => (
    <TextField
      label={label}
      value={typed[key]}
      onChange={(event) =>
        setTyped((current) => ({ ...current, [key]: event.target.value }))
      }
      error={typed.invalid}
      size="small"
      slotProps={{ htmlInput: { inputMode: "decimal" } }}
      // On a phone both fields share the first row, and the buttons the second
      sx={{ ...FIELD, flex: { xs: "1 1 calc(50% - 4px)", sm: 1 }, minWidth: 0 }}
    />
  );

  return (
    <Box component="section" aria-label={t("manualFarm:goTo:title")}>
      <Box component="h3" sx={{ ...EYEBROW, marginBottom: 1.5 }}>
        {t("manualFarm:goTo:title")}
      </Box>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          go();
        }}
        sx={{
          display: "flex",
          flexWrap: { xs: "wrap", sm: "nowrap" },
          gap: 1,
          alignItems: "flex-start",
        }}
      >
        {field("lat", t("manualFarm:goTo:latitude"))}
        {field("lng", t("manualFarm:goTo:longitude"))}
        <Button
          type="submit"
          sx={{ ...SECONDARY_BUTTON, height: 40, minWidth: 56, flex: { xs: 1, sm: "none" } }}
        >
          {t("manualFarm:actions:go")}
        </Button>
        <Button
          startIcon={<AddLocationAltOutlinedIcon />}
          onClick={add}
          disabled={addDisabled}
          sx={{ ...SECONDARY_BUTTON, height: 40, flex: { xs: 2, sm: "none" } }}
        >
          {t("manualFarm:actions:addPoint")}
        </Button>
      </Box>
      {typed.invalid && (
        <Box
          component="p"
          sx={{ margin: "6px 0 0", fontSize: 12.5, color: FLOW_COLORS.bad }}
        >
          {t("manualFarm:goTo:invalid")}
        </Box>
      )}
    </Box>
  );
};

// A coordinate typed with a dot or a comma as the decimal separator
const parseCoordinate = (value: string): number | null => {
  const text = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
};
