"use client";

import { Theme } from "@emotion/react";
import {
  ListSubheader,
  MenuItem,
  Select as MUISelect,
  SelectChangeEvent,
  SxProps,
} from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface SelectOption {
  value: string;
  label: string;
  /** Consecutive options with the same group go under one subheader. */
  group?: { key: string; label: React.ReactNode };
}

interface SelectProps {
  searchParamKey: string;
  options: SelectOption[];
  defaultValue: string;
  style?: SxProps<Theme>;
  renderOption?: (option: { value: string; label: string }) => React.ReactNode;
}

export const SearchParamSelector: React.FC<SelectProps> = ({
  searchParamKey: valueKey,
  defaultValue,
  options,
  style,
  renderOption,
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const value = searchParams.get(valueKey) || defaultValue;

  const handleOnChange = useCallback(
    (event: SelectChangeEvent) => {
      const params = new URLSearchParams(searchParams);
      params.set(valueKey, event.target.value);
      replace(`${pathname}?${params.toString()}`);
    },
    [pathname, replace, searchParams, valueKey]
  );

  return (
    <MUISelect
      value={value}
      margin="dense"
      sx={{ ...style }}
      size="small"
      onChange={handleOnChange}
    >
      {options.flatMap(({ value, label, group }, index) => {
        const item = (
          <MenuItem key={value} value={value}>
            {renderOption?.({ value, label }) ?? label}
          </MenuItem>
        );
        if (!group || options[index - 1]?.group?.key === group.key) return [item];
        return [
          <ListSubheader key={`group-${group.key}`}>{group.label}</ListSubheader>,
          item,
        ];
      })}
    </MUISelect>
  );
};
