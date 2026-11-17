"use client";

import { Box, Typography, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AvailableCountry } from "@/hooks/useAvailableCountries";
import type { CountryLayerCatalogState } from "@/hooks/useCountryLayerCatalog";
import { groupLayersByCategory } from "@/utils/layerCatalog";
import { CatalogStatus } from "./CatalogStatus";
import { CategoryBlock } from "./CategoryBlock";
import { CountryTabs, countryPanelId } from "./CountryTabs";

interface CountryLayersSectionProps {
  countries: AvailableCountry[];
  countriesLoading: boolean;
  countriesError: boolean;
  country: string | null;
  onSelectCountry: (code: string) => void;
  catalog: CountryLayerCatalogState;
}

/**
 * "Capas por país": a tab per country and, for the selected one, its categories
 * with their layers. The selected tab is the page's, never the session's country.
 */
export const CountryLayersSection: React.FC<CountryLayersSectionProps> = ({
  countries,
  countriesLoading,
  countriesError,
  country,
  onSelectCountry,
  catalog,
}) => {
  const { t } = useTranslation();
  const colors = useTheme().palette.landing;

  if (countriesLoading) {
    return <Typography role="status" sx={{ color: colors.muted }}>{t("methodology:countries:loading")}</Typography>;
  }
  if (countriesError) {
    return <Typography role="alert">{t("methodology:countries:error")}</Typography>;
  }
  if (!country || countries.length === 0) {
    return <Typography sx={{ color: colors.muted }}>{t("methodology:countries:empty")}</Typography>;
  }

  const countryName = countries.find((c) => c.code === country)?.name ?? country;

  return (
    <Box sx={{ mt: 1 }}>
      <CountryTabs countries={countries} selected={country} onSelect={onSelectCountry} />
      <Box role="tabpanel" id={countryPanelId(country)} aria-labelledby={`${countryPanelId(country)}-tab`}>
        <CatalogStatus state={catalog} countryName={countryName} />
        {catalog.status === "ready" &&
          (catalog.catalog.categories.length === 0 && catalog.catalog.maps.length === 0 ? (
            <Typography sx={{ color: colors.muted }}>
              {t("methodology:catalog:empty", { country: countryName })}
            </Typography>
          ) : (
            groupLayersByCategory(catalog.catalog.categories, catalog.catalog.maps).map(
              ({ category, layers }) => (
                <CategoryBlock key={category?.id ?? "__others"} category={category} layers={layers} />
              )
            )
          ))}
      </Box>
    </Box>
  );
};
