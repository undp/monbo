"use client";

import { Box, useTheme } from "@mui/material";
import { getCountryShape } from "@/utils/countryShape";

interface CountryPillProps {
  code: string;
  name: string;
  selected: boolean;
  onSelect: (code: string) => void;
}

/** A country to choose in the start bar: its silhouette and its name. */
export const CountryPill: React.FC<CountryPillProps> = ({ code, name, selected, onSelect }) => {
  const colors = useTheme().palette.landing;
  const shape = getCountryShape(code);

  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(code)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        padding: "6px 16px 6px 12px",
        borderRadius: 999,
        border: `1px solid ${selected ? colors.forest : colors.line}`,
        backgroundColor: selected ? colors.forest : "transparent",
        color: selected ? "#fff" : colors.ink,
        font: "inherit",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
        transition: "background-color .15s, color .15s",
        "& path": {
          fill: selected ? colors.leafLight : colors.silhouette,
          transition: "fill .15s",
        },
        "&:hover": selected
          ? {}
          : { backgroundColor: colors.mint, "& path": { fill: colors.leaf } },
        "&:focus-visible": { outline: `3px solid ${colors.blue}`, outlineOffset: 2 },
      }}
    >
      {shape && (
        <Box component="svg" viewBox="0 0 100 100" aria-hidden sx={{ width: 22, height: 22, flex: "none" }}>
          <path d={shape} />
        </Box>
      )}
      {name}
    </Box>
  );
};
