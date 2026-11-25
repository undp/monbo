"use client";

import {
  OutlinedInput,
  InputAdornment,
  SxProps,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { debounce } from "lodash";
import { Theme } from "@emotion/react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SearchBarProps {
  placeholder: string;
  style?: SxProps<Theme>;
}

export const SearchBar: React.FC<SearchBarProps> = ({ placeholder, style }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [searchTerm, setSearchTerm] = useState(
    searchParams.get("search") || ""
  );

  // Keep searchTerm in sync with URL params
  useEffect(() => {
    setSearchTerm(searchParams.get("search") || "");
  }, [searchParams]);

  // Create a memoized debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((term: string) => {
        const params = new URLSearchParams(searchParams);
        if (term) {
          params.set("search", term);
        } else {
          params.delete("search");
        }
        replace(`${pathname}?${params.toString()}`);
      }, 300),
    [pathname, replace, searchParams]
  );

  // Clean up the debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setSearchTerm(newValue); // Update the input immediately
      debouncedSearch(newValue); // Debounce the URL update
    },
    [debouncedSearch]
  );

  const handleClear = useCallback(() => {
    setSearchTerm("");
    const params = new URLSearchParams(searchParams);
    params.delete("search");
    replace(`${pathname}?${params.toString()}`);
  }, [pathname, replace, searchParams]);

  return (
    <OutlinedInput
      sx={{ backgroundColor: "white", ...style }}
      size="small"
      placeholder={placeholder}
      startAdornment={
        <InputAdornment position="start">
          <SearchIcon />
        </InputAdornment>
      }
      endAdornment={
        searchTerm ? (
          <InputAdornment position="end">
            <IconButton onClick={handleClear} edge="end">
              <ClearIcon />
            </IconButton>
          </InputAdornment>
        ) : null
      }
      onChange={handleChange}
      value={searchTerm}
    />
  );
};
