"use client";

import { Box, Tab, Tabs, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AvailableCountry } from "@/hooks/useAvailableCountries";
import { getCountryShape } from "@/utils/countryShape";

interface CountryTabsProps {
  countries: AvailableCountry[];
  selected: string;
  onSelect: (code: string) => void;
}

/** id of a country's tab panel, for `aria-controls`. */
export const countryPanelId = (code: string) => `methodology-country-${code}`;

/**
 * One tab per country, with its silhouette. Choosing one only changes what the
 * methodology page shows: it never touches the session's analysis country.
 */
export const CountryTabs: React.FC<CountryTabsProps> = ({ countries, selected, onSelect }) => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;

  return (
    <Tabs
      value={selected}
      onChange={(_, code: string) => onSelect(code)}
      variant="scrollable"
      scrollButtons={false}
      aria-label={t("methodology:countries:label")}
      sx={{
        minHeight: 0,
        mb: 3,
        borderBottom: `1px solid ${colors.line}`,
        "& .MuiTabs-indicator": { backgroundColor: colors.forest, height: 3 },
      }}
    >
      {countries.map(({ code, name }) => {
        const shape = getCountryShape(code);
        return (
          <Tab
            key={code}
            value={code}
            id={`${countryPanelId(code)}-tab`}
            aria-controls={countryPanelId(code)}
            label={name}
            iconPosition="start"
            icon={
              shape ? (
                <Box component="svg" viewBox="0 0 100 100" aria-hidden sx={{ width: 20, height: 20 }}>
                  <path d={shape} fill="currentColor" />
                </Box>
              ) : undefined
            }
            sx={{
              minHeight: 44,
              textTransform: "none",
              fontSize: 15,
              fontWeight: 500,
              color: colors.inkSecondary,
              "&.Mui-selected": { color: colors.forest },
            }}
          />
        );
      })}
    </Tabs>
  );
};
