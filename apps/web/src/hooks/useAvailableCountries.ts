import { useContext, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DataContext } from "@/context/DataContext";
import { getCountryName } from "@/utils/countries";

export interface AvailableCountry {
  code: string;
  name: string;
}

/**
 * The countries that can be analyzed (`GET /countries`), with their name in the
 * current language, sorted by name. `loading` is true until the first list
 * arrives, and `error` when fetching it failed before that.
 */
export function useAvailableCountries(): {
  countries: AvailableCountry[];
  loading: boolean;
  error: boolean;
} {
  const {
    availableCountries,
    availableCountriesLoaded,
    availableCountriesError,
  } = useContext(DataContext);
  const { i18n } = useTranslation();

  const countries = useMemo(() => {
    const language = i18n.language as "en" | "es";
    return availableCountries
      .map((code) => ({ code, name: getCountryName(code, language) ?? code }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  }, [availableCountries, i18n.language]);

  const error = availableCountriesError && !availableCountriesLoaded;
  return { countries, loading: !availableCountriesLoaded && !error, error };
}
