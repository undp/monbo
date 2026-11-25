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
  label?: string;
  compact?: boolean;
  selectedOption: SelectionOption | null;
  options: SelectionOption[];
  onChange: (id: string) => void;
}
export const SingleSelector: React.FC<Props> = ({
  sx,
  label,
  compact,
  selectedOption,
  options,
  onChange,
}) => {
  return (
    <Box sx={sx}>
      <FormControl fullWidth>
        <InputLabel
          id="single-select-label"
          size={compact ? "small" : undefined}
        >
          {label ?? "Seleccionar"}
        </InputLabel>
        <Select
          labelId="single-select-label"
          value={selectedOption?.id ?? ""}
          label={label ?? "Seleccionar"}
          size={compact ? "small" : undefined}
          onChange={(e) => onChange(e.target.value as string)}
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
