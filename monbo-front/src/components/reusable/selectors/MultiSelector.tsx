"use client";

import { SelectionOption } from "@/interfaces/SelectionOption";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SxProps,
} from "@mui/material";
import React from "react";

interface Props {
  sx?: SxProps;
  compact?: boolean;
  label?: string;
  selectedOptions: SelectionOption[];
  options: SelectionOption[];
  onChange: (ids: string[]) => void;
}
export const MultiSelector: React.FC<Props> = ({
  sx,
  label,
  compact,
  selectedOptions,
  options,
  onChange,
}) => {
  return (
    <Box sx={sx}>
      <FormControl fullWidth>
        <InputLabel
          id="multi-select-label"
          size={compact ? "small" : undefined}
        >
          {label ?? "Seleccionar"}
        </InputLabel>
        <Select
          labelId="multi-select-label"
          multiple
          size={compact ? "small" : undefined}
          value={selectedOptions.map((opt) => opt.id)} // array of selected ids
          label={label ?? "Seleccionar"}
          onChange={(e) => {
            const value = e.target.value;
            onChange(typeof value === "string" ? value.split(",") : value);
          }}
          renderValue={(selected) =>
            options
              .filter((opt) => selected.includes(opt.id))
              .map((opt) => opt.label)
              .join(", ")
          }
        >
          {options.map((opt) => (
            <MenuItem key={opt.id} value={opt.id}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};
// ... existing code ...
