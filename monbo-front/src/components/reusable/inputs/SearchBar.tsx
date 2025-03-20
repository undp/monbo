"use client";

import { OutlinedInput, InputAdornment, SxProps } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { debounce } from "lodash";
import { Theme } from "@emotion/react";

interface SearchBarProps {
  placeholder: string;
  style?: SxProps<Theme>;
}

export const SearchBar: React.FC<SearchBarProps> = ({ placeholder, style }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleSearch = debounce((term: string) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set("search", term);
    } else {
      params.delete("search");
    }
    replace(`${pathname}?${params.toString()}`);
  }, 300);

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
      onChange={(e) => handleSearch(e.target.value)}
      defaultValue={searchParams.get("search")?.toString()}
    />
  );
};
