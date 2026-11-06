"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, TextField, Typography } from "@mui/material";
import AddLocationAltOutlinedIcon from "@mui/icons-material/AddLocationAltOutlined";
import { Coordinates } from "@/interfaces/Map";

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
      sx={{ flex: 1 }}
    />
  );

  return (
    <>
      <Box
        component="form"
        onSubmit={(event) => {
          event.preventDefault();
          go();
        }}
        sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
      >
        {field("lat", t("manualFarm:goTo:latitude"))}
        {field("lng", t("manualFarm:goTo:longitude"))}
        <Button type="submit" variant="outlined" sx={{ height: 40 }}>
          {t("manualFarm:actions:go")}
        </Button>
        <Button
          variant="outlined"
          startIcon={<AddLocationAltOutlinedIcon />}
          onClick={add}
          disabled={addDisabled}
          sx={{ height: 40, whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {t("manualFarm:actions:addPoint")}
        </Button>
      </Box>
      {typed.invalid && (
        <Typography variant="caption" color="error">
          {t("manualFarm:goTo:invalid")}
        </Typography>
      )}
    </>
  );
};

// A coordinate typed with a dot or a comma as the decimal separator
const parseCoordinate = (value: string): number | null => {
  const text = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
};
