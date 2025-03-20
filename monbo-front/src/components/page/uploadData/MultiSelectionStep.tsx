"use client";

import { Box, Checkbox, FormControlLabel, SxProps } from "@mui/material";
import React from "react";

interface Props {
  sx?: SxProps;
  selectedOptions: {
    id: string;
    label: string;
  }[];
  options: {
    id: string;
    label: string;
  }[];
  onChange: (id: string, checked: boolean) => void;
}
export const MultiSelectionStep: React.FC<Props> = ({
  selectedOptions,
  options,
  onChange,
  sx,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: "36px",
        ...sx,
      }}
    >
      {options.map((opt) => (
        <FormControlLabel
          sx={{
            width: "max-content",
          }}
          key={opt.id}
          value={opt.id}
          checked={!!selectedOptions.find((so) => so.id === opt.id)}
          control={<Checkbox color="primary" />}
          label={opt.label}
          onChange={(_, checked: boolean) => onChange(opt.id, checked)}
        />
      ))}
    </Box>
  );
};
