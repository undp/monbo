import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { getCountryName, getLayersCountryCodes } from "@/utils/countries";

export interface AvailableCountry {
  code: string;
  name: string;
}

/**
 * The countries that have at least one layer, with their name in the current
 * language, sorted by name. `loading` is true until the first layer list arrives.
 */
export function useAvailableCountries(): {
  countries: AvailableCountry[];
  loading: boolean;
} {
  const { availableMaps, availableMapsLoaded } = useContext(DataContext);
  const { i18n } = useTranslation();

  const countries = useMemo(() => {
    const language = i18n.language as "en" | "es";
    return getLayersCountryCodes(availableMaps)
      .map((code) => ({ code, name: getCountryName(code, language) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  }, [availableMaps, i18n.language]);

  return { countries, loading: !availableMapsLoaded };
}
